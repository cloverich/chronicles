CREATE TABLE `bulk_operation_items` (
	`operationId` text NOT NULL,
	`documentId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`processedAt` text,
	PRIMARY KEY(`operationId`, `documentId`),
	FOREIGN KEY (`operationId`) REFERENCES `bulk_operations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bulk_operation_items_status_idx` ON `bulk_operation_items` (`status`);--> statement-breakpoint
CREATE TABLE `bulk_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`search` text NOT NULL,
	`params` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`startedAt` text,
	`completedAt` text,
	`totalItems` integer NOT NULL,
	`successCount` integer DEFAULT 0,
	`errorCount` integer DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `bulk_operations_status_idx` ON `bulk_operations` (`status`);--> statement-breakpoint
CREATE TABLE `document_links` (
	`documentId` text NOT NULL,
	`targetId` text NOT NULL,
	`targetJournal` text NOT NULL,
	`resolvedAt` text,
	PRIMARY KEY(`documentId`, `targetId`),
	FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_links_target_idx` ON `document_links` (`targetId`);--> statement-breakpoint
CREATE TABLE `document_tags` (
	`documentId` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`documentId`, `tag`),
	FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tags_name_idx` ON `document_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`title` text,
	`journal` text NOT NULL,
	`frontmatter` text NOT NULL,
	`mtime` integer,
	`size` integer,
	`contentHash` text,
	FOREIGN KEY (`journal`) REFERENCES `journals`(`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documents_title_idx` ON `documents` (`title`);--> statement-breakpoint
CREATE INDEX `documents_createdat_idx` ON `documents` (`createdAt`);--> statement-breakpoint
CREATE TABLE `image_links` (
	`documentId` text NOT NULL,
	`imagePath` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`lastChecked` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`documentId`, `imagePath`),
	FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `image_links_path_idx` ON `image_links` (`imagePath`);--> statement-breakpoint
CREATE INDEX `image_links_resolved_idx` ON `image_links` (`resolved`);--> statement-breakpoint
CREATE TABLE `import_files` (
	`importerId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`chroniclesId` text NOT NULL,
	`sourcePathResolved` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`extension` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `import_notes` (
	`importerId` text NOT NULL,
	`status` text NOT NULL,
	`chroniclesId` text NOT NULL,
	`chroniclesPath` text NOT NULL,
	`sourcePath` text PRIMARY KEY NOT NULL,
	`sourceId` text,
	`error` integer,
	`journal` text NOT NULL,
	`frontMatter` text,
	`content` text
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`importDir` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journals` (
	`name` text PRIMARY KEY NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archivedAt` text
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journal` text,
	`date` text,
	`idx` integer,
	`type` text,
	`contents` text,
	`attributes` text
);
--> statement-breakpoint
CREATE TABLE `sync` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`startedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completedAt` text,
	`syncedCount` integer,
	`errorCount` integer,
	`durationMs` integer
);
