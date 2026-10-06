-- Content-addressed attachments. Moving legacy flat files into the pool and
-- rewriting references needs the filesystem, so it runs at startup:
-- AttachmentStore.migrateLegacyLayout (src/node-client/attachments.ts).
CREATE TABLE `attachments` (
	`sha256` text PRIMARY KEY NOT NULL,
	`ext` text NOT NULL,
	`mime` text NOT NULL,
	`byteSize` integer NOT NULL,
	`originalName` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
