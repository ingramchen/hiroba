import type { Database } from '../db/client.js';
import type { Accounts, Sessions } from './account.js';
import type { Anchors } from './anchor.js';
import type { ChatterRepository } from './chatter.js';
import type { DevLoginConfig } from './devLogin.js';
import type { RemoteAddressSource } from './http.js';
import type { SquareDirectory } from './directory.js';
import type { Identities } from './identity.js';
import type { JoinRecords } from './joinRecord.js';
import type { OidcClient } from './oidc.js';
import type { PasskeyChallenges, Passkeys } from './passkey.js';
import type { Permissions } from './permission.js';
import type { Posters } from './poster.js';
import type { RoomHub } from './room/hub.js';
import type { Clock } from './room/types.js';
import type { Squares } from './square.js';
import type { ModerationService } from './moderation/service.js';
import type { MediaServices } from './storage/index.js';
import type { SysImageFeed } from './sysImages.js';
import type { VoteService } from './vote.js';
import type { SiteWipe } from './wipe.js';

export interface Services {
  db: Database;
  hub: RoomHub;
  directory: SquareDirectory;
  identities: Identities;
  clock: Clock;
  chatters: ChatterRepository;
  squares: Squares;
  anchors: Anchors;
  joinRecords: JoinRecords;
  permissions: Permissions;
  accounts: Accounts;
  sessions: Sessions;
  passkeys: Passkeys;
  passkeyChallenges: PasskeyChallenges;
  votes: VoteService;
  oidc: OidcClient | null;
  devLogin: DevLoginConfig | null;
  posters: Posters;
  media: MediaServices | null;
  moderation: ModerationService | null;
  sysImages: SysImageFeed;
  wipe: SiteWipe | null;
}

export interface AppOptions {
  sysPassword?: string | null;
  remoteAddress?: RemoteAddressSource;
  timeZone?: string;
  timeZoneConfigured?: boolean;
}
