CREATE TABLE `image_moderation` (
	`media_key` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`state` text NOT NULL,
	`create_time` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `index_image_moderation_topic` ON `image_moderation` (`topic`,`create_time`);