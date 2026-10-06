-- Note links become ID-only: `../<journal>/<id>.md` → `chronicles://note/<id>`.
-- chronicles_store_note_links() is registered on the connection by factory.ts;
-- it rewrites link destinations only and preserves every other byte.
UPDATE `documents` SET `content` = chronicles_store_note_links(`content`);
--> statement-breakpoint
UPDATE `documents_fts` SET `content` = chronicles_store_note_links(`content`);
--> statement-breakpoint
ALTER TABLE `document_links` DROP COLUMN `targetJournal`;
