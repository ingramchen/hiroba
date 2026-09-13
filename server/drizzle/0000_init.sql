CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`username_folded` text,
	`email` text DEFAULT '' NOT NULL,
	`nickname` text NOT NULL,
	`account_domain` text NOT NULL,
	`account_uuid` text NOT NULL,
	`kerma_value` integer NOT NULL,
	`kerma_last_update_time` integer DEFAULT 0 NOT NULL,
	`kerma_forbid_forever` integer DEFAULT false NOT NULL,
	`color_token` text,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`forbid_from_chat_until` integer DEFAULT 0 NOT NULL,
	`show_color_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_account_username` ON `account` (`username_folded`);--> statement-breakpoint
CREATE UNIQUE INDEX `index_account_uuid` ON `account` (`account_uuid`);--> statement-breakpoint
CREATE TABLE `account_session` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_session_expires` ON `account_session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `account_session_account` ON `account_session` (`account_id`);--> statement-breakpoint
CREATE TABLE `anchor_square` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anchor_id` integer NOT NULL,
	`topic` text NOT NULL,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`sealed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`anchor_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anchor_square_topic_unique` ON `anchor_square` (`topic`);--> statement-breakpoint
CREATE TABLE `anonymous` (
	`anonymous_id` text PRIMARY KEY NOT NULL,
	`kerma_value` integer NOT NULL,
	`kerma_last_update_time` integer DEFAULT 0 NOT NULL,
	`kerma_forbid_forever` integer DEFAULT false NOT NULL,
	`color_token` text,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`forbid_from_chat_until` integer DEFAULT 0 NOT NULL,
	`show_color_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chatter_permission` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`private_id` text NOT NULL,
	`public_id` text NOT NULL,
	`start_ips` text NOT NULL,
	`kerma_enough` integer NOT NULL,
	`anchor` integer DEFAULT false NOT NULL,
	`anchorable` integer DEFAULT false NOT NULL,
	`anchor_square` integer DEFAULT false NOT NULL,
	`anchor_username` text DEFAULT '' NOT NULL,
	`chatter_create_time` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chatter_permission_expires` ON `chatter_permission` (`expires_at`);--> statement-breakpoint
CREATE TABLE `co_anchor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`anchor_square_id` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`anchor_square_id`) REFERENCES `anchor_square`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_co_anchor_account_anchor_square` ON `co_anchor` (`account_id`,`anchor_square_id`);--> statement-breakpoint
CREATE TABLE `join_record` (
	`id` text PRIMARY KEY NOT NULL,
	`join_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`topic` text NOT NULL,
	`public_id` text NOT NULL,
	`private_id` text NOT NULL,
	`nickname` text NOT NULL,
	`ips` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`color_token` text,
	`forbid` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `join_record_address` ON `join_record` (`address`);--> statement-breakpoint
CREATE INDEX `join_record_topic_address` ON `join_record` (`topic`,`address`);--> statement-breakpoint
CREATE UNIQUE INDEX `join_record_topic_public_id` ON `join_record` (`topic`,`public_id`);--> statement-breakpoint
CREATE TABLE `oauth_state` (
	`state` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`verifier` text NOT NULL,
	`return_to` text NOT NULL,
	`remember` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkey` (
	`credential_id` text PRIMARY KEY NOT NULL,
	`account_id` integer NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_account` ON `passkey` (`account_id`);--> statement-breakpoint
CREATE TABLE `passkey_challenge` (
	`challenge` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`account_id` integer,
	`handle` text,
	`account_uuid` text,
	`rp_id` text NOT NULL,
	`origin` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `poster` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`create_time` integer NOT NULL,
	`creator_public_id` text NOT NULL,
	`creator_nickname` text NOT NULL,
	`creator_color_token` text,
	`poster_type` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `poster_topic` ON `poster` (`topic`);--> statement-breakpoint
CREATE TABLE `square` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`message` text NOT NULL,
	`create_date` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `index_square_topic` ON `square` (`topic`);--> statement-breakpoint
CREATE TABLE `square_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`thumb_url` text,
	`thumb_width` integer,
	`thumb_height` integer,
	`sealed` integer DEFAULT false NOT NULL,
	`min_kerma_value` integer DEFAULT 0 NOT NULL,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `square_info_topic_unique` ON `square_info` (`topic`);--> statement-breakpoint
CREATE TABLE `square_live` (
	`topic` text PRIMARY KEY NOT NULL,
	`crowd` integer DEFAULT 0 NOT NULL,
	`last_access` integer NOT NULL,
	`latest_messages` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `square_live_crowd` ON `square_live` (`crowd`);--> statement-breakpoint
CREATE INDEX `square_live_last_access` ON `square_live` (`last_access`);--> statement-breakpoint
CREATE TABLE `sys_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`actor` text NOT NULL,
	`session` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target` text NOT NULL,
	`topic` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `index_sys_audit_create_time` ON `sys_audit` (`create_time`);--> statement-breakpoint
CREATE TABLE `voting` (
	`id` text PRIMARY KEY NOT NULL,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`end_time` integer DEFAULT 0 NOT NULL,
	`creator_public_id` text NOT NULL,
	`creator_nickname` text NOT NULL,
	`creator_color_token` text,
	`topic` text NOT NULL,
	`title` text NOT NULL,
	`option_votes` text NOT NULL,
	`voter_count` integer DEFAULT 0 NOT NULL,
	`multiple_choice_config` integer DEFAULT 1 NOT NULL,
	`voting_goal` text NOT NULL,
	`applied` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `index_voting_create_time` ON `voting` (`topic`,`create_time`);