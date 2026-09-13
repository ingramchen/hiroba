import type { Database } from '../db/client.js';
import { Accounts, Sessions } from './account.js';
import { Anchors } from './anchor.js';
import type { Services } from './types.js';
import { publishVote } from './effects.js';
import { ChatterRepository } from './chatter.js';
import { SquareDirectory } from './directory.js';
import {
  devLoginRequested,
  readDevLoginConfig,
  warnDevLoginEnabled,
  warnDevLoginIgnored,
} from './devLogin.js';
import { Identities } from './identity.js';
import { optionalValue, readModerationConfig, warnModerationOff } from './config.js';
import { ModerationService } from './moderation/service.js';
import { JoinRecords } from './joinRecord.js';
import { OidcClient, readOidcConfig } from './oidc.js';
import { PasskeyChallenges, Passkeys } from './passkey.js';
import { Permissions } from './permission.js';
import { Posters } from './poster.js';
import { RoomHub } from './room/hub.js';
import {
  systemClock,
  systemTimers,
  type Clock,
  type RoomStore,
  type Timers,
} from './room/types.js';
import { Squares } from './square.js';
import { SqliteRoomStore } from './store.js';
import { SysImageFeed } from './sysImages.js';
import type { MediaServices } from './storage/build.js';
import { VoteService } from './vote.js';
import type { SiteWipe } from './wipe.js';

export interface BuildServicesOptions {
  db: Database;
  tokenSecret: string;
  clock?: Clock;
  timers?: Timers;
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  /** The fetch the classifier is reached through; falls back to `fetcher`. */
  moderationFetcher?: typeof fetch;
  media?: MediaServices | null;
  wipe?: SiteWipe | null;
}

export function buildServices(options: BuildServicesOptions): Services {
  const clock = options.clock ?? systemClock;
  const timers = options.timers ?? systemTimers;
  const squares = new Squares(options.db);
  const joinRecords = new JoinRecords(options.db);
  const sysImages = new SysImageFeed(clock.now());
  const store = new SqliteRoomStore(options.db);
  const observed: RoomStore = {
    ensureSquare: (topic, now) => {
      store.ensureSquare(topic, now);
    },
    loadRing: (topic) => store.loadRing(topic),
    appendMessage: (topic, event) => {
      store.appendMessage(topic, event);
      sysImages.observe(topic, event);
    },
    writeLive: (live) => {
      store.writeLive(live);
    },
    isForbidden: (topic, ips, publicId) => store.isForbidden(topic, ips, publicId),
  };
  const services = {
    db: options.db,
    hub: new RoomHub({
      store: observed,
      clock,
      timers,
      blockedMedia: (content) => services.moderation?.blocksAnyOf(content) ?? false,
    }),
    directory: new SquareDirectory(options.db),
    identities: new Identities(options.tokenSecret),
    clock,
    chatters: new ChatterRepository(options.db),
    squares,
    anchors: new Anchors(options.db, squares),
    joinRecords,
    permissions: new Permissions(options.db),
    accounts: new Accounts(options.db),
    sessions: new Sessions(options.db),
    passkeys: new Passkeys(options.db),
    passkeyChallenges: new PasskeyChallenges(options.db),
    posters: new Posters(options.db),
    sysImages,
    oidc: null,
    devLogin: readDevLoginConfig(options.env ?? {}),
    media: options.media ?? null,
    moderation: null,
    wipe: options.wipe ?? null,
  } as Services;

  services.votes = new VoteService(
    options.db,
    clock,
    timers,
    (topic, payload) => {
      publishVote(services)(topic, payload);
    },
    (topic, ips, publicId) => joinRecords.isForbidden(topic, ips, publicId),
  );

  const oidcConfig = readOidcConfig(options.env ?? {});
  services.oidc =
    oidcConfig === null ? null : new OidcClient(options.db, oidcConfig, options.fetcher ?? fetch);

  if (services.devLogin !== null) {
    warnDevLoginEnabled(services.devLogin);
  } else if (devLoginRequested(options.env ?? {})) {
    warnDevLoginIgnored();
  }

  const moderationConfig = readModerationConfig(options.env ?? {});
  if (moderationConfig === null) {
    warnModerationOff();
  } else {
    services.moderation = new ModerationService(
      services,
      moderationConfig,
      options.moderationFetcher ?? options.fetcher ?? fetch,
      optionalValue(options.env ?? {}, 'PUBLIC_ORIGIN'),
    );
  }

  return services;
}
