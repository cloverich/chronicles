DELETE FROM `documents`;--> statement-breakpoint
DELETE FROM `document_tags`;--> statement-breakpoint
DELETE FROM `document_links`;--> statement-breakpoint
DELETE FROM `image_links`;--> statement-breakpoint
DELETE FROM `sync`;--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(id, title, content, tokenize='porter unicode61');--> statement-breakpoint
DELETE FROM `documents_fts`;--> statement-breakpoint
ALTER TABLE `documents` DROP COLUMN `mtime`;--> statement-breakpoint
ALTER TABLE `documents` DROP COLUMN `size`;--> statement-breakpoint
ALTER TABLE `documents` DROP COLUMN `contentHash`;--> statement-breakpoint
ALTER TABLE `documents` ADD `content` text DEFAULT '' NOT NULL;
