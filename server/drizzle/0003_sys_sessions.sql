CREATE TABLE `sys_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `index_sys_session_expires_at` ON `sys_session` (`expires_at`);