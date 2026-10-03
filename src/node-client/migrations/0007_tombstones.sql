CREATE TABLE `tombstones` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`deletedAt` text NOT NULL,
	`lastRevision` text
);
