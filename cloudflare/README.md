# Deploying to Cloudflare Workers

The TypeScript stack runs on Cloudflare as one Worker, two Durable Object classes and four R2
buckets. Nothing here needs a paid add-on; the free plan covers every binding used, within the
limits at the bottom of this page.

Everything below has been exercised against the real Workers runtime locally (`wrangler dev`,
which runs the same `workerd` a deployment runs) and deployed to one account, the demo the
README links. What has only been read from Cloudflare's documentation rather than seen on that
account is marked _not verified against a real account_.

## The shape

| Piece | What it is |
| --- | --- |
| Worker (`server/src/adapters/cf/worker.ts`) | a forwarder: a `/ws/<topic>` upgrade goes to that topic's square object, everything else to the one app object. It answers nothing itself except the single-page shell when the app object has no route for a path |
| `AppDO` | the whole server: routes, services, the room hub, the scheduler, and the database. Durable-object SQLite is synchronous, so the database object *is* the application object |
| `SquareDO` | one per topic, holds that topic's WebSockets so hibernation works, and forwards each message to `AppDO` |
| Static assets | `web/dist`, served by Workers Static Assets before the Worker runs |
| R2 | four buckets reached over R2's S3 compatible API: images, cached remote media, video, and the web-loader cache |
| `IMGMOD` (optional) | a Workers VPC service binding to the image classifier, see below |

There is one app object for the whole site, with a soft ceiling around 1,000 requests a second.
That is a deliberate trade: it is what lets every SQLite call stay synchronous and the server code
stay identical to the one that runs on node.

## Before the first deploy

1. Node 24 and pnpm, then `pnpm install`.
2. A Cloudflare account. `pnpm exec wrangler login` (every `wrangler` command below is
   `pnpm exec wrangler …`; the binary is a dev dependency, not on your PATH).
3. An R2 API token (Cloudflare dashboard, R2 → Manage API tokens) with object read and write.
   That token's access key id and secret are `S3_ACCESS_KEY` and `S3_SECRET_KEY`.
4. Edit `wrangler.json`:
   - `S3_ENDPOINT` — replace `ACCOUNT_ID` with your account id, so it reads
     `https://<account id>.r2.cloudflarestorage.com`.
   - `PUBLIC_ORIGIN` — the origin browsers reach the site on, if you want Google login.
   - `SCHEDULE_TIME_ZONE` — the zone the nightly maintenance jobs read their clock in.
   - The four bucket names, if you want something other than the defaults.
5. Set the secrets:

```
wrangler secret put TOKEN_SECRET        # long random, signs account and chatter tokens
wrangler secret put WEB_LOADER_KEY      # long random, signs remote media load urls
wrangler secret put SYS_PASSWORD        # admin console password, /-/sys
wrangler secret put S3_ACCESS_KEY
wrangler secret put S3_SECRET_KEY
wrangler secret put GOOGLE_CLIENT_ID    # optional, see the Login section of DEVELOPMENT.md
wrangler secret put GOOGLE_CLIENT_SECRET
```

`TOKEN_SECRET` is the only one the app object refuses to start without: it fails the boot with
`TOKEN_SECRET is not set` and every request answers 500 until it is set. With the storage
settings present, `WEB_LOADER_KEY` is required the same way.

**Do not set `TRUST_PROXY`.** The Worker deletes the client's `x-forwarded-for` and carries
Cloudflare's own `cf-connecting-ip` instead, so exactly one address reaches the application and
the setting cannot change which one. Setting it does nothing here; copying it out of the compose
file is how a deployment behind a proxy hands a visitor control of the address they are banned by.

## The image classifier

Image moderation calls a classifier the Worker cannot reach over the public internet when it
lives on a private network. Bind it as a **Workers VPC service** instead of publishing it:

1. Create a Cloudflare Tunnel (`cloudflared`) on a host that can reach the classifier, and a
   VPC Service pointing at the classifier's address and port through that tunnel. The tunnel
   needs no ingress rules: the service definition is the route.
2. Add the binding to `wrangler.json`:

```json
"vpc_services": [{ "binding": "IMGMOD", "service_id": "<the service id>" }]
```

3. `wrangler secret put IMGMOD_TOKEN` with the classifier's bearer token.

With the binding present the app object calls the classifier through it and `IMGMOD_URL` is
optional: a VPC binding routes by the service definition, so the url only fills the `Host`
header, and it defaults to `http://imgmod.vpc`. Set `IMGMOD_URL` yourself only when the
classifier is reachable by a plain url, in which case leave the binding out. Without either the
Worker runs with moderation off, and says so at boot.

Workers VPC is in beta and free on every Workers plan; the API token that deploys needs the
account permission **Connectivity Directory** at the level that may bind services.

## Deploy

```
./cloudflare/deploy.sh
```

It builds, creates the four buckets, sets their lifecycle rules, prints them back, and deploys.
Re-running it is safe.

To do it by hand:

```
pnpm -r build
wrangler r2 bucket create hiroba-img          # and -c, -v, -cache
wrangler r2 bucket lifecycle set hiroba-img --file cloudflare/r2-lifecycle.json --force
wrangler deploy
```

The build step is not optional: it writes `web/dist`, which is what Static Assets uploads, and it
generates `server/src/adapters/cf/migrations.generated.ts`, which is how the schema reaches the
durable object.

### Object expiry is part of the deploy

Uploads are written under a `t/` or an `m/` first path component and the bucket deletes them —
`t/` after seven days, `m/` after thirty-five. **No code does this**: nothing in the app deletes
an expired object, so the bucket's lifecycle rules are the only thing that removes one. If they
are missing, nothing fails and nothing is logged; the objects simply stay forever.
`cloudflare/r2-lifecycle.json` holds the two rules and `cloudflare/r2-lifecycle-cache.json` the
one for the web-loader cache (`w/`, seven days).

`wrangler r2 bucket lifecycle set` replaces a bucket's whole configuration, so the deploy script
is idempotent. `lifecycle add` would append a duplicate rule on every run; do not use it here.

Check what a bucket actually has with `wrangler r2 bucket lifecycle list <bucket>`.
The deploy script has applied these files to real R2 buckets and read them back, so R2 accepts
the shape; that R2 then deletes an aged object has not been watched here, only read from its
documentation. The rules exist for this deployment only: a node deployment gets nothing from
these files or from the compose file and sets its own on its buckets, see the Configuration
section of `DEVELOPMENT.md`.

## Wiping the site on a schedule

The Worker has a `scheduled` handler that calls the app object's `wipe`: every object in
`S3_BUCKET_IMG`, `S3_BUCKET_C`, `S3_BUCKET_V` and `S3_BUCKET_CACHE` is deleted, then the object's
storage is cleared — squares, messages, accounts, passkeys, bans and the sys audit log all go with
it. The object restarts and the next request boots an empty database from the migration bundle.
It is what keeps a demo deployment from accumulating other people's uploads.

Only a Cron Trigger schedules it; a `wrangler.json` without one wipes nothing. To run the wipe
nightly declare

```json
"triggers": { "crons": ["0 20 * * *"] }
```

and deploy. Cron expressions are UTC only, so `0 20 * * *` is 04:00 in Asia/Taipei. Removing the
line and deploying again stops the schedule; a cron only exists once `wrangler deploy` has applied
it.

The same wipe is reachable by hand as `POST /api/sys/wipe` with a logged-in console session and
the body `{"confirm":"wipe"}`. There is no button for it in the console.

## Running it locally against the Workers runtime

`wrangler dev` runs the deployed code in `workerd`, the runtime Cloudflare runs, with local
storage. It needs an S3 compatible server for media; MinIO on port 9000 is what the compose file
already provides.

```
cp .dev.vars.example .dev.vars      # then edit
pnpm -r build
wrangler dev
```

`.dev.vars` is local only and is not uploaded.

## What is checked automatically

**One dependency is a pre-release**: `wrangler` pulls in `miniflare@5.20260910.0-alpha`, listed
under `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. There is no stable 5.x — the `latest`
tag *is* the alpha. The 3.x line pins a 2025-07 `workerd`, which cannot honour the
`compatibility_date` below.

`compatibility_date` is `2026-09-01` with `nodejs_compat`. Every runtime behaviour the adapter
relies on — `node:crypto`, durable-object SQLite, WebSocket hibernation — was checked at that
date; an earlier date genuinely changes the runtime (`node:crypto` is absent at `2026-08-01`).
Move it forward only together with a run of `pnpm check`.

## Free plan

_Not verified against a real account._ These are the published limits as of 2026-09-12; the
figures a real deployment bills against may differ and are the ones to trust.

| Limit | Value | What it means here |
| --- | --- | --- |
| Worker requests | 100,000/day | every page view, asset miss, API call and WebSocket connection |
| Durable Objects | SQLite-backed only | which is what this uses; `AppDO` and `SquareDO` are both declared as SQLite classes, so nothing here needs the paid tier |
| Durable Object storage | 1 GB per object, 5 GB per account | the whole database lives in one object, so 1 GB is the ceiling on the site's data |
| Durable Object CPU | 30 s per request or message | a thumbnail of a 4000×3000 image measures ~580 ms, so images are comfortable |
| Worker CPU | 10 ms per request | the fronting Worker only forwards, so it stays well inside this. Nothing that costs real CPU may be moved out of the app object |
| Static assets | 20,000 files, 25 MiB each | `web/dist` is about 430 files and 3 MB |
| Bundle | 64 MiB uncompressed | the Worker bundle including the image codec is about 2.9 MB |

WebSocket messages are billed 20 incoming messages to one request, and hibernating sockets are
not billed for the time they sit idle. A connected client sends a heartbeat every three minutes,
so an always-open tab costs about 24 requests a day on its own.

Apart from the optional wipe cron above nothing is scheduled outside the app object: expiry is the
bucket's job, and the nightly maintenance runs off a durable-object alarm.

## Things a deployment will meet that the local runtime cannot show

- **`cf-connecting-ip`**: the whole client-address design assumes Cloudflare's edge sets this
  header and a client cannot supply its own. That is the documented behaviour; the local runtime
  does not enforce it, so it is unverified here.
- **R2's own behaviour**: R2 does not implement `x-amz-acl` on PutObject, so the adapter does not
  send it. Whether real R2 rejects or merely ignores an unexpected ACL header is untested.
- **Request timeouts**: on node, the media fetch timeout is a socket-idle timeout; here it is a
  total deadline. A slow but progressing download that node would allow is cut off here.
- **Eviction**: when Cloudflare evicts the app object it loses the live crowd counts and the room
  membership. The object re-admits the sockets its square objects still hold when it comes back,
  but each re-admitted client gets a second `ready` frame. How often eviction happens in practice
  is not something the local runtime can show.
