# Development and deployment

## Configuration

The server keeps its state in a SQLite file rather than a database server, and
it reads its settings from the environment only. `.env` is read by `docker
compose`, which turns it into that environment and supplies development
defaults for everything except `TOKEN_SECRET`; a server started by hand gets
nothing from `.env` and needs every variable exported.

One domain and a set of S3 compatible credentials are the whole deployment:
the server puts uploads in the buckets and serves them back itself, under
`/-/img/<bucket>/<key>`, so a media url is that path on the
site's own origin. Whether an image belongs to the site — which is what decides
that a square thumbnail may be built from it — is read off that base, nothing
else.

Uploads expire the way the original buckets did: objects under `t/` in each
bucket (uploaded images and videos) are meant to go seven days after they were
stored, objects under `m/` (poster images) after thirty-five days. Nothing in
the server deletes an expired object; the bucket's lifecycle rules do, so set
them on each bucket (MinIO: `mc ilm import`; on Cloudflare the deploy script
sets them, see `cloudflare/README.md`). Without the rules nothing fails and
nothing is logged; the objects simply stay. Square thumbnails (`t/thumb_…`) are
one-week objects like any other upload and are also deleted with their picture.

The shipped compose file is one of the places without them: its `minio-init`
service creates the buckets and sets no lifecycle rules, so a deployment built
on it has to add them itself: `cloudflare/minio-lifecycle.json` holds the two
rules in MinIO's import format, so `mc ilm import local/hiroba-img <
cloudflare/minio-lifecycle.json` (and again for `hiroba-c` and `hiroba-v`)
is enough. They are the same prefix-and-age entries the
`cloudflare/r2-lifecycle*.json` files carry for R2.

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `TOKEN_SECRET` | yes | none | signs account and chatter tokens; compose has no default for it either |
| `PORT` | no | `3000` | port to listen on |
| `DB_PATH` | no | `./hiroba.sqlite` | the SQLite file; the image sets `/data/hiroba.sqlite`, on a volume. Set but blank refuses to start (a blank line in `.env` must not silently move the data). The database is opened in WAL mode, so `-wal` and `-shm` files appear beside it |
| `WEB_DIST` | no | `public` | directory the built client is served from; relative paths resolve against the server package |
| `TRUST_PROXY` | no | `0` | how many right-hand entries of `X-Forwarded-For` were written by proxies you run. `0` trusts none and identifies a visitor by the connecting socket address; behind one reverse proxy set `1`. Set too low every visitor looks like one address, and a single forbid then covers the whole square; set too high a visitor picks the address they are banned by |
| `SYS_PASSWORD` | no | none | admin console password; unset disables the console, the compose file fills in `hiroba-dev-sys-password`. The console is served at `/-/sys` (`SYS_CONSOLE_PATH` in `shared/`) |
| `S3_ENDPOINT` | with media | none | S3 compatible endpoint. With this, `S3_ACCESS_KEY` or `S3_SECRET_KEY` unset the server starts with images, video and the media loader switched off; the compose file fills in `http://minio:9000` |
| `S3_REGION` | no | `us-east-1` | storage region |
| `S3_ACCESS_KEY` | with media | none | storage access key; the compose file fills in `hirobaminio` |
| `S3_SECRET_KEY` | with media | none | storage secret key; the compose file fills in `hirobaminio` |
| `S3_BUCKET_IMG` | no | `hiroba-img` | bucket for uploaded images |
| `S3_BUCKET_C` | no | `hiroba-c` | bucket for cached remote media |
| `S3_BUCKET_V` | no | `hiroba-v` | bucket the original server converted videos into. Nothing is written to it any more; what is already there is still served, and expires by the bucket's rules like the rest |
| `WEB_LOADER_KEY` | with media | none | signs remote media load requests, and is served to every visitor in the client config. Once the storage settings are present the server refuses to start without it |
| `WEB_LOADER_HOSTS` | no | `imgur.com,i.imgur.com,pbs.twimg.com,kekeke.cc` | comma separated hosts the loader will fetch from; when set it replaces the defaults. A link to any other host still works, it just opens in a new tab instead of rendering inline. `*` allows any host. Addresses that resolve to private ranges and URLs with a non-default port are refused whatever this is set to. Remote fetches are limited to 60 per client and 600 in total per minute; cache hits are not counted |
| `WEB_LOADER_CACHE_PATH` | no | none | directory for loaded media; unset keeps nothing on disk. `WEB_LOADER_RESULT_PATH` is accepted as a fallback name |
| `UPLOAD_LIMIT_MB` | no | `25` | largest single upload accepted, in megabytes. Both the request body limit and the stored-object check read it. A value that is not a positive number keeps the default rather than refusing everything |
| `FLAKE_NODE_ID` | no | `1` | id generator node number |
| `TZ` | no | `Asia/Taipei` | the container's time zone |
| `SCHEDULE_TIME_ZONE` | no | `UTC` | the zone the nightly maintenance jobs and the console charts read their clock in, independent of the rest of the process. A value the runtime cannot resolve stops the server at boot |
| `IMGMOD_URL` | no | none | image classifier base url; the server posts each upload to `<url>/classify` and applies the verdict. Unset, or the literal `naive`, mounts a built-in reference classifier instead, which is never mounted under `NODE_ENV=production` — there moderation is simply off and every upload shows unmasked |
| `IMGMOD_TOKEN` | no | none | bearer token sent to the classifier |

A missing required variable stops the server at boot with a `<NAME> is not set`
message, `<NAME>` being the environment name itself. A variable set to an empty
string counts as unset. A `PORT` that is not a port number stops the server at
boot rather than binding something else.

The console session also authorises `POST /api/sys/wipe`, which empties every media bucket and
resets the database; the body must be `{"confirm":"wipe"}` and no page in the console calls it.
Only the Cloudflare adapter implements the database reset — the node server answers it `501
WIPE_UNAVAILABLE`, because resetting the file database means closing it, replacing it and
rebuilding every service around it while requests are in flight.

The login variables are in the next section. `OIDC_ISSUER`,
`OIDC_AUTHORIZATION_ENDPOINT`, `OIDC_TOKEN_ENDPOINT` and `OIDC_JWKS_URI`
override the Google endpoints and default to Google's own; a fork pointing at
another OpenID provider is the reason they exist.

`GET /healthz` answers `ok` as plain text whenever the process is up. It is
what the compose healthcheck calls. It does not touch the database or storage,
so it reports liveness, not readiness.

## Login

The site is anonymous first. Anyone can open a topic and talk in it with no
account at all. Login only adds the account features: a handle, claiming a
topic as an anchor square, inviting a co-anchor by their handle, and carrying
the same kerma between devices.

Two logins are built in, and the login dialog is two buttons: Google and
passkey. **Passkeys** work with nothing configured. The button asks your device
or password manager for a passkey it already holds for the site and signs you
in with it; when there is none it asks you to pick a handle and creates one.
That passkey then signs you in on every device it is synced to. One passkey is
one account, so there is nothing to manage, no list of devices and no second
credential to add — and a passkey lost without a sync copy means a new account,
not a recovered one. Passkeys need a secure page, `https://` or plain
`http://localhost`, and a host name rather than an IP address; anywhere else,
`http://192.168.1.10:3000` for instance, the button is greyed out and says
which of the two is missing.

**Google** needs the three variables below; until they are set its button is
greyed out and passkeys are the only way in. The two logins lead to separate
accounts: a Google account has no passkey and never gains one, and the passkey
button always signs into a passkey account, so a handle taken on one side
cannot be claimed on the other.

The server reads these from the environment:

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `PUBLIC_ORIGIN` | no | none | the origin browsers reach the site on, for example `http://localhost:3000`; the Google redirect uri is built from it |
| `GOOGLE_CLIENT_ID` | no | none | OAuth client id; unset leaves Google login off; passkeys work regardless |
| `GOOGLE_CLIENT_SECRET` | no | none | OAuth client secret |
| `DEV_LOGIN` | no | none | `1` opens the development login below; anything else leaves it closed. Ignored under `NODE_ENV=production` (the image default; compose passes `NODE_ENV` through) |
| `DEV_LOGIN_TOKEN` | no | random per boot | the token the development login asks from callers that are not on plain loopback; printed in the startup warning when generated |

All three of `PUBLIC_ORIGIN`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
have to be set together, or Google login stays off (passkeys are unaffected).

### Your own Google client

1. In the [Google Cloud console](https://console.cloud.google.com/) create a
   project, or pick one you already have.
2. Under APIs & Services configure the OAuth consent screen. External is the
   right choice for a public site; while it is in testing, add the accounts you
   want to sign in with as test users.
3. Under Credentials create an OAuth client id of type **Web application**.
4. Add one authorised redirect uri, your origin followed by
   `/auth/google/callback`, for example
   `http://localhost:3000/auth/google/callback` or
   `https://example.com/auth/google/callback`. It has to match `PUBLIC_ORIGIN`
   exactly, scheme, host and port included.
5. Put the client id and secret in `.env` together with `PUBLIC_ORIGIN` and
   restart.

The server asks for the `openid email profile` scopes. The address is used to
recognise a returning account and is never shown to anyone; other people only
ever see the handle you choose.

### The development login

A third way in drives login without a browser ceremony. Set `DEV_LOGIN=1` and
the server opens

```
POST /api/dev/login   {"subject": "alice"}
```

which creates or finds a development account for that subject and sets the same
session cookie a Google login would. Two calls with the same subject land on the
same account, so you can hold two browsers and try the co-anchor and cross
device kerma paths.

It is closed unless `DEV_LOGIN` is exactly `1`, it refuses any caller that is
not on a loopback or private address (including a request a proxy forwarded
from a public one), it refuses a body not declared as `application/json`, and
the server prints a warning on every start while it is on.

A caller that is not on plain loopback (a browser reaching a container, a
machine on the same LAN) also has to present the development login token. The
server generates one per boot and prints it in that warning, or takes the one
in `DEV_LOGIN_TOKEN`. Open

```
http://localhost:3000/api/dev/login?token=<token>
```

once in the browser; it stores the token in a cookie and the login dialog works
from then on. A script can send it as the `x-dev-login-token` header or as
`token` in the body instead. Until then the login answers `403` with
`{"error": "DEV_LOGIN_TOKEN_REQUIRED"}`, which is how the dialog knows to point
at this step rather than report a plain refusal. Refused attempts are rate
limited.

**Never set `DEV_LOGIN` on a deployment other people can reach.** Anyone who
can reach the port can become any account on the site.

## Production

The compose file is meant for development and ships throwaway defaults. For a
real deployment set `TOKEN_SECRET`, `SYS_PASSWORD` and `WEB_LOADER_KEY` to your
own long random values, leave `DEV_LOGIN` unset, and point the database and S3
settings at your own server with credentials you control.

## Cloudflare

The TypeScript stack also runs on Cloudflare Workers, with the server inside a Durable Object,
R2 for media and Workers Static Assets for the client. One Worker, two durable object classes
and four buckets; no paid add-on. `cloudflare/README.md` is the deploy guide, `wrangler.json`
the configuration and `cloudflare/deploy.sh` the one command that does it.

`wrangler` depends on `miniflare`, which is a pre-release and is therefore listed under
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. There is no stable 5.x; the older stable
line pins a runtime a year behind the `compatibility_date` this project deploys against.

On Cloudflare, expired uploads are removed by R2 bucket lifecycle rules rather than by the
server, which is what the deploy script configures; `cloudflare/README.md` says why that matters.

## Licenses

The source code is under the MIT License; see `LICENSE`. The name "kekeke" and
the site kekeke.cc are not: they belong to that site, and this project makes no
claim on them.

The artwork is not covered by that license either. Each set keeps the license
of its upstream, and the notices live next to the files, in `art/LICENSE`, in
`web/public/-/emoji/LICENSE` and in `web/src/assets/gwt-standard/LICENSE`:

- The legacy smileys are the "Default" theme of
  [Pidgin](https://pidgin.im/) 2.10.12, under the GNU General Public License,
  version 2 or later (`art/COPYING`).
- Emoji artwork is provided by [Emojitwo](https://emojitwo.github.io/),
  originally released as [Emojione 2.2](https://www.emojione.com) by
  [Ranks.com](http://www.ranks.com) with contributions from the Emojitwo
  community and is licensed under
  [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). The
  files shipped here were rendered from the SVG originals to PNG.
- The GWT "Standard" widget theme stylesheet and its four sprite sheets in
  `web/src/assets/gwt-standard/` are Copyright Google Inc., under the
  [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- The kmark renderer in `shared/src/kmark.ts` is a port of
  [txtmark](https://github.com/rjeschke/txtmark), Copyright (C) 2011 René
  Jeschke, under the
  [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).
  See `NOTICE`.

The same credits are shown in the app, in the About dialog reached from the
footer.
