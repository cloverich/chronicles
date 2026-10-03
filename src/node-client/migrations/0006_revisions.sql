-- Revision = sha256 of the canonical note (computeRevision in
-- canonical-note.ts). chronicles_note_revision() is registered by factory.ts.
ALTER TABLE `documents` ADD `revision` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `documents` SET `revision` = chronicles_note_revision(
	`id`, `title`, `journalId`, `createdAt`, `updatedAt`,
	(SELECT json_group_array(`tag`) FROM `document_tags` WHERE `documentId` = `documents`.`id`),
	`frontmatter`, `content`
);
