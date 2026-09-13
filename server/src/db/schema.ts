import { sql } from 'drizzle-orm';
import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const epoch = sql`0`;
const now = sql`(unixepoch() * 1000)`;

export const square = sqliteTable(
  'square',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    topic: text('topic').notNull(),
    message: text('message').notNull(),
    createDate: integer('create_date', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('index_square_topic').on(t.topic)],
);

export const squareInfo = sqliteTable('square_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topic: text('topic').notNull().unique(),
  thumbPath: text('thumb_url'),
  thumbWidth: integer('thumb_width'),
  thumbHeight: integer('thumb_height'),
  thumbSourcePath: text('thumb_source_path'),
  sealed: integer('sealed', { mode: 'boolean' }).notNull().default(false),
  minKermaValue: integer('min_kerma_value').notNull().default(0),
  createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const account = sqliteTable(
  'account',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username'),
    usernameFolded: text('username_folded'),
    email: text('email').notNull().default(''),
    nickname: text('nickname').notNull(),
    accountDomain: text('account_domain').notNull(),
    accountUuid: text('account_uuid').notNull(),
    kermaValue: integer('kerma_value').notNull(),
    kermaLastUpdateTime: integer('kerma_last_update_time', { mode: 'timestamp_ms' })
      .notNull()
      .default(epoch),
    kermaForbidForever: integer('kerma_forbid_forever', { mode: 'boolean' })
      .notNull()
      .default(false),
    colorToken: text('color_token'),
    createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
    forbidFromChatUntil: integer('forbid_from_chat_until', { mode: 'timestamp_ms' })
      .notNull()
      .default(epoch),
    showColorUntil: integer('show_color_until', { mode: 'timestamp_ms' }).notNull().default(epoch),
  },
  (t) => [
    uniqueIndex('index_account_username').on(t.usernameFolded),
    uniqueIndex('index_account_uuid').on(t.accountUuid),
  ],
);

export const anchorSquare = sqliteTable('anchor_square', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  anchorId: integer('anchor_id')
    .notNull()
    .references(() => account.id),
  topic: text('topic').notNull().unique(),
  createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
  sealed: integer('sealed', { mode: 'boolean' }).notNull().default(false),
});

export const coAnchor = sqliteTable(
  'co_anchor',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    anchorSquareId: integer('anchor_square_id')
      .notNull()
      .references(() => anchorSquare.id),
  },
  (t) => [uniqueIndex('index_co_anchor_account_anchor_square').on(t.accountId, t.anchorSquareId)],
);

export const voting = sqliteTable(
  'voting',
  {
    id: text('id').primaryKey(),
    createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
    endTime: integer('end_time', { mode: 'timestamp_ms' }).notNull().default(epoch),
    creatorPublicId: text('creator_public_id').notNull(),
    creatorNickname: text('creator_nickname').notNull(),
    creatorColorToken: text('creator_color_token'),
    topic: text('topic').notNull(),
    title: text('title').notNull(),
    optionVotes: text('option_votes').notNull(),
    voterCount: integer('voter_count').notNull().default(0),
    multipleChoiceConfig: integer('multiple_choice_config').notNull().default(1),
    votingGoal: text('voting_goal').notNull(),
    applied: integer('applied', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('index_voting_create_time').on(t.topic, t.createTime)],
);

export const joinRecord = sqliteTable(
  'join_record',
  {
    id: text('id').primaryKey(),
    joinTime: integer('join_time', { mode: 'timestamp_ms' }).notNull().default(now),
    topic: text('topic').notNull(),
    publicId: text('public_id').notNull(),
    privateId: text('private_id').notNull(),
    nickname: text('nickname').notNull(),
    ips: text('ips').notNull(),
    address: text('address').notNull().default(''),
    colorToken: text('color_token'),
    forbid: integer('forbid', { mode: 'boolean' }).notNull(),
  },
  (t) => [
    index('join_record_address').on(t.address),
    index('join_record_topic_address').on(t.topic, t.address),
    uniqueIndex('join_record_topic_public_id').on(t.topic, t.publicId),
  ],
);

export const anonymous = sqliteTable('anonymous', {
  anonymousId: text('anonymous_id').primaryKey(),
  kermaValue: integer('kerma_value').notNull(),
  kermaLastUpdateTime: integer('kerma_last_update_time', { mode: 'timestamp_ms' })
    .notNull()
    .default(epoch),
  kermaForbidForever: integer('kerma_forbid_forever', { mode: 'boolean' }).notNull().default(false),
  colorToken: text('color_token'),
  createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
  forbidFromChatUntil: integer('forbid_from_chat_until', { mode: 'timestamp_ms' })
    .notNull()
    .default(epoch),
  showColorUntil: integer('show_color_until', { mode: 'timestamp_ms' }).notNull().default(epoch),
});

export const poster = sqliteTable(
  'poster',
  {
    id: text('id').primaryKey(),
    topic: text('topic').notNull(),
    createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull(),
    creatorPublicId: text('creator_public_id').notNull(),
    creatorNickname: text('creator_nickname').notNull(),
    creatorColorToken: text('creator_color_token'),
    posterType: text('poster_type').notNull(),
    body: text('body').notNull(),
  },
  (t) => [index('poster_topic').on(t.topic)],
);

export const squareLive = sqliteTable(
  'square_live',
  {
    topic: text('topic').primaryKey(),
    crowd: integer('crowd').notNull().default(0),
    lastAccess: integer('last_access').notNull(),
    latestMessages: text('latest_messages').notNull().default('[]'),
  },
  (t) => [
    index('square_live_crowd').on(t.crowd),
    index('square_live_last_access').on(t.lastAccess),
  ],
);

export const chatterPermission = sqliteTable(
  'chatter_permission',
  {
    id: text('id').primaryKey(),
    topic: text('topic').notNull(),
    privateId: text('private_id').notNull(),
    publicId: text('public_id').notNull(),
    startIps: text('start_ips').notNull(),
    kermaEnough: integer('kerma_enough', { mode: 'boolean' }).notNull(),
    anchor: integer('anchor', { mode: 'boolean' }).notNull().default(false),
    anchorable: integer('anchorable', { mode: 'boolean' }).notNull().default(false),
    anchorSquare: integer('anchor_square', { mode: 'boolean' }).notNull().default(false),
    anchorUsername: text('anchor_username').notNull().default(''),
    chatterCreateTime: integer('chatter_create_time', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('chatter_permission_expires').on(t.expiresAt)],
);

export const accountSession = sqliteTable(
  'account_session',
  {
    id: text('id').primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeen: integer('last_seen', { mode: 'timestamp_ms' }).notNull(),
    revoked: integer('revoked', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('account_session_expires').on(t.expiresAt),
    index('account_session_account').on(t.accountId),
  ],
);

export const oauthState = sqliteTable('oauth_state', {
  state: text('state').primaryKey(),
  nonce: text('nonce').notNull(),
  verifier: text('verifier').notNull(),
  returnTo: text('return_to').notNull(),
  remember: integer('remember', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const passkey = sqliteTable(
  'passkey',
  {
    credentialId: text('credential_id').primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    publicKey: blob('public_key', { mode: 'buffer' }).notNull(),
    counter: integer('counter').notNull().default(0),
    transports: text('transports').notNull().default('[]'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  },
  (t) => [uniqueIndex('passkey_account').on(t.accountId)],
);

export const passkeyChallenge = sqliteTable('passkey_challenge', {
  challenge: text('challenge').primaryKey(),
  kind: text('kind').notNull(),
  accountId: integer('account_id'),
  handle: text('handle'),
  accountUuid: text('account_uuid'),
  rpId: text('rp_id').notNull(),
  origin: text('origin').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sysAudit = sqliteTable(
  'sys_audit',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
    actor: text('actor').notNull(),
    session: text('session').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    target: text('target').notNull(),
    topic: text('topic').notNull().default(''),
    detail: text('detail').notNull().default(''),
  },
  (t) => [index('index_sys_audit_create_time').on(t.createTime)],
);

export const sysSession = sqliteTable(
  'sys_session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('index_sys_session_expires_at').on(t.expiresAt)],
);

export const imageModeration = sqliteTable(
  'image_moderation',
  {
    mediaKey: text('media_key').primaryKey(),
    topic: text('topic').notNull(),
    state: text('state').notNull(),
    createTime: integer('create_time', { mode: 'timestamp_ms' }).notNull().default(now),
  },
  (t) => [index('index_image_moderation_topic').on(t.topic, t.createTime)],
);
