# Chronicles MCP Server Implementation Plan

Reference: [GitHub Issue #353](https://github.com/cloverich/chronicles/issues/353)

## Overview

Implement a local MCP (Model Context Protocol) server to expose Chronicles functionality via JSON-RPC over Unix socket. This enables AI tools like Claude Code and Cursor to read/write notes programmatically.

## Architecture Decision

**Chosen Approach: Main Process MCP Server**

- Location: `src/electron/mcp/`
- Security: External clients access through main process only
- Reuse: Bridge pattern to reuse existing preload clients
- Transport: Unix socket (default), localhost HTTP (fallback)
- Optional: Disabled by default, enabled via preferences UI

## MCP Methods (Final Spec)

1. `listJournals()` → Array of journal names
2. `searchNotes(query, limit?, before?)` → Note metadata with full search syntax support
3. `getNote(id)` → Complete note with content and frontmatter
4. `getNoteMetadata(id)` → Metadata only for performance
5. `createNote(journal, content, frontmatter?)` → Create with optional YAML frontmatter
6. `updateNote(id, content?, frontmatter?)` → Partial updates supported

**Punted:** `uploadAttachment()` (complexity, lower usage)

## Implementation Structure

```
src/electron/mcp/
├── server.ts           // MCP server setup (JSON-RPC + Unix socket)
├── handlers.ts         // MCP method implementations
├── bridge.ts           // Bridge to reuse preload clients
└── types.ts           // MCP-specific types/interfaces
```

### Bridge Pattern

```typescript
// src/electron/mcp/bridge.ts
import { createClient } from "../preload/client";

export class MCPBridge {
  private client = createClient(); // Reuse existing client pattern

  async searchNotes(query: string, limit?: number) {
    return this.client.documents.search(query, { limit });
  }

  async getNote(id: string) {
    return this.client.documents.get(id);
  }
  // ... other methods
}
```

## Error Handling

RFC 7807-style structured errors:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "type": "https://chronicles.app/errors/validation-error",
      "title": "Document validation failed",
      "detail": "Invalid journal name 'invalid-journal'",
      "instance": "/notes/create",
      "invalid_params": ["journal"]
    }
  },
  "id": 1
}
```

## Configuration

**User Preferences:**

- MCP server enabled/disabled (default: disabled)
- Socket path (default: `~/.chronicles/mcp.sock`)
- Optional: HTTP port fallback
- Optional: Authentication token

**Implementation:**

- Extend existing `IPreferences` interface
- Add MCP settings section to preferences UI immediately
- Use electron-store for persistence

## Integration Points

1. **Startup**: Initialize MCP server in `src/electron/index.js` after database migration
2. **Configuration**: Extend existing preferences system
3. **Database**: Reuse existing better-sqlite3 and Knex connections via bridge
4. **Validation**: Apply same security validation as existing `validateChroniclesUrl()`
5. **Lifecycle**: Start/stop MCP server with main process

## Security Considerations

- Validate all requests against configured notes directory
- No direct database/filesystem access from external clients
- Unix socket provides process-level security by default
- Maintain existing path validation and access controls
- Consider optional token-based authentication for future

## Graceful Degradation

- Return "service unavailable" when Chronicles not running
- `ping()` method for client health checks
- Document MCP manifest requirements
- Client retry logic with exponential backoff

## Implementation Phase Plan

**Phase 1: Core Infrastructure**

1. MCP server setup with Unix socket
2. Bridge pattern implementation
3. Basic error handling
4. Preferences UI integration

**Phase 2: Read Operations**

1. `listJournals()`
2. `searchNotes()` with full search syntax
3. `getNote()` and `getNoteMetadata()`

**Phase 3: Write Operations**

1. `createNote()`
2. `updateNote()`
3. Enhanced error handling and validation

**Phase 4: Polish**

1. HTTP fallback transport
2. Authentication options
3. Performance optimization
4. Documentation and examples

## Search Capabilities to Expose

Based on existing SearchStore.ts infrastructure:

- **Journal filtering**: `in:journal_name`
- **Tag filtering**: `tag:tagname` or `tag:#tagname`
- **Title search**: `title:search_term`
- **Full-text search**: `text:search_term`
- **Date filtering**: `before:date_or_id`
- **Free text**: Unqualified terms treated as `text:term`
- **Pagination**: Cursor-based with `before:` parameter
- **Metadata**: Full YAML frontmatter support

This leverages Chronicles' mature search system with token-based parsing, case-insensitive matching, and efficient pagination.
