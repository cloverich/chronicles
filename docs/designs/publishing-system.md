# Design Doc: Publishing System (Phase 1)

## Context

Chronicles is a high-fidelity markdown editor. Users want to bridge the gap between private journaling and public publishing (e.g., Hugo, Astro, Substack). This system provides a way to "export" documents into external structures while maintaining asset integrity (images/links).

## Goals

1.  **Personal Blog Support:** Enable seamless publishing to Hugo/Astro.
2.  **Asset Management:** Automatically relocate and relink images for the target platform.
3.  **CLI Compatibility:** Ensure the publishing logic can be extracted into a standalone CLI tool.
4.  **Extensibility:** Design "Publication Targets" so that Substack or Medium can be added later.

## Architecture

### 1. The Core Logic Library (`src/lib/publisher/`)

A pure, framework-agnostic library for transforming Chronicles content for external targets.

- `transformMDAST(mdast, config)`: Relocates images and updates URLs.
- `generateFrontmatter(fm, config)`: Maps Chronicles metadata to target YAML.
- `AssetMapper`: Calculates source -> destination mappings.

### 2. The Preload Client Layer (`src/preload/client/publisher.ts`)

The primary interface for the Electron UI and the starting point for the CLI.

- `publish(docId, targetId)`: Coordinates the full workflow.
- `getTargets()`: Returns the list of configured `PublicationTargets` from preferences.
- `preview(docId, targetId)`: Returns the transformed Markdown without writing to disk.

### 3. Publication Targets

Defined in `preferences.json`, a target includes:

- `id`: Unique identifier.
- `type`: `astro`, `hugo`, `substack`, etc.
- `paths`: `contentDir`, `assetDir`, `assetPrefix`.
- `frontmatterTemplate`: Mapping rules.

### 3. State Management

A new table `document_publications` will track:

- `documentId`: Link to the note.
- `targetId`: Which target it was sent to.
- `publishedAt`: Timestamp.
- `lastSyncHash`: MD5 of the content to detect if the public version is out of date.

## UI Integration

- **Publish Toggle:** A new button in the editor header (visible only if targets are configured).
- **Target Picker:** If multiple targets exist, show a dropdown.
- **Status Indicator:** Show "Live" or "Modified since last publish" in the sidebar.

## CLI Integration

The logic in `src/lib/publisher.ts` will be designed as a pure function that takes a `Document` and a `TargetConfig` and returns a `PublishManifest` (the content + a list of file system operations). This allows a lightweight CLI to perform the same action without the full Electron app.

## Evaluation (Success Criteria)

- I can publish a post with 3 images to an Astro project, and the images display correctly in `astro dev`.
- The publishing logic can be run via a script without opening the Chronicles UI.
- Changes to the note in Chronicles show it as "Modified" in the publish UI.
