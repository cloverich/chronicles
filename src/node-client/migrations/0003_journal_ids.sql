-- Journals get a stable uuid25 id; documents reference journals by id.
-- Requires foreign_keys=OFF (see runMigrations in factory.ts): dropping the
-- old journals table would otherwise cascade-delete every document.
-- chronicles_create_id() is registered on the connection by factory.ts.
CREATE TABLE `__new_journals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archivedAt` text
);
--> statement-breakpoint
INSERT INTO `__new_journals` (`id`, `name`, `createdAt`, `updatedAt`, `archivedAt`)
	SELECT chronicles_create_id(`createdAt`), `name`, `createdAt`, `updatedAt`, `archivedAt` FROM `journals`;
--> statement-breakpoint
INSERT INTO `__new_journals` (`id`, `name`)
	SELECT chronicles_create_id(NULL), `journal` FROM (
		SELECT DISTINCT `journal` FROM `documents`
		WHERE `journal` NOT IN (SELECT `name` FROM `__new_journals`)
	);
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`title` text,
	`journalId` text NOT NULL,
	`frontmatter` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`journalId`) REFERENCES `journals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_documents` (`id`, `createdAt`, `updatedAt`, `title`, `journalId`, `frontmatter`, `content`)
	SELECT d.`id`, d.`createdAt`, d.`updatedAt`, d.`title`, j.`id`, d.`frontmatter`, d.`content`
	FROM `documents` d JOIN `__new_journals` j ON j.`name` = d.`journal`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
DROP TABLE `journals`;
--> statement-breakpoint
ALTER TABLE `__new_journals` RENAME TO `journals`;
--> statement-breakpoint
CREATE UNIQUE INDEX `journals_name_unique` ON `journals` (`name`);
--> statement-breakpoint
CREATE INDEX `documents_title_idx` ON `documents` (`title`);
--> statement-breakpoint
CREATE INDEX `documents_createdat_idx` ON `documents` (`createdAt`);
--> statement-breakpoint
CREATE INDEX `documents_journalid_idx` ON `documents` (`journalId`);
