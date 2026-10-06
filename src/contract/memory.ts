import { compareCodePoints, serializeNote } from "./canonical";
import {
  NotesError,
  type CreateNoteRequest,
  type Journal,
  type Note,
  type NoteQuery,
  type NotesClient,
  type SearchNotesRequest,
  type UpdateNoteRequest,
} from "./notes";
import { asciiLower, isDateToken, validateJournalName } from "./rules";

/**
 * Reference NotesClient held entirely in memory. It defines the contract's
 * behavior in the smallest amount of code, runs anywhere (browser, Node,
 * tests), and is checked against the same fixtures as the real adapters.
 */

export interface MemoryLibrary {
  journals: { id: string; name: string; archivedAt?: string | null }[];
  notes: (Omit<Note, "revision" | "tags" | "frontMatter"> & {
    tags?: string[];
    frontMatter?: Record<string, unknown>;
  })[];
}

interface StoredJournal {
  id: string;
  name: string;
  archived: boolean;
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

async function sha256(data: Uint8Array | string): Promise<string> {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

function newId(): string {
  // Not a uuid25; the reference adapter only needs uniqueness.
  return (
    "m" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12)
  ).padEnd(25, "0");
}

const sortTags = (tags: string[]) =>
  Array.from(new Set(tags)).sort(compareCodePoints);

export function createMemoryNotesClient(
  seed: MemoryLibrary = { journals: [], notes: [] },
): NotesClient & { ready: Promise<void> } {
  const journals = new Map<string, StoredJournal>();
  const notes = new Map<string, Note>();
  const attachments = new Map<string, Uint8Array>();

  const revisionOf = (n: Omit<Note, "revision">) =>
    sha256(
      serializeNote({
        id: n.id,
        title: n.title,
        journal: n.journalId,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        tags: n.tags,
        frontMatter: n.frontMatter,
        content: n.content,
      }),
    );

  const store = async (n: Omit<Note, "revision">): Promise<Note> => {
    const note = { ...n, tags: sortTags(n.tags) };
    const stored = { ...note, revision: await revisionOf(note) };
    notes.set(n.id, stored);
    return stored;
  };

  const journalByName = (name: string) =>
    [...journals.values()].find((j) => asciiLower(j.name) === asciiLower(name));

  const requireJournal = (id: string, code: "invalid_input" | "not_found") => {
    const j = journals.get(id);
    if (!j) throw new NotesError(code, `Journal ${id} not found`);
    return j;
  };

  const toJournal = (j: StoredJournal): Journal => ({
    id: j.id,
    name: j.name,
    archived: j.archived,
    noteCount: [...notes.values()].filter((n) => n.journalId === j.id).length,
  });

  const validName = (name: string) => {
    try {
      return validateJournalName(name);
    } catch (err) {
      throw new NotesError("invalid_input", (err as Error).message);
    }
  };

  const matches = (n: Note, q: NoteQuery) => {
    if (q.journalIds?.length && !q.journalIds.includes(n.journalId)) {
      return false;
    }
    if (q.excludeJournalIds?.includes(n.journalId)) return false;
    if (q.tags?.length && !q.tags.some((t) => n.tags.includes(t))) {
      return false;
    }
    if (q.excludeTags?.some((t) => n.tags.includes(t))) return false;
    for (const t of q.titles ?? []) {
      if (!asciiLower(n.title ?? "").includes(asciiLower(t))) return false;
    }
    for (const t of q.texts ?? []) {
      const haystack = asciiLower(`${n.title ?? ""} ${n.content}`);
      if (!new RegExp(`\\b${escapeRegExp(asciiLower(t))}`).test(haystack)) {
        return false;
      }
    }
    if (q.date && !n.createdAt.startsWith(q.date)) return false;
    return true;
  };

  const ready = (async () => {
    for (const j of seed.journals) {
      journals.set(j.id, { id: j.id, name: j.name, archived: !!j.archivedAt });
    }
    for (const n of seed.notes) {
      await store({
        ...n,
        tags: n.tags ?? [],
        frontMatter: n.frontMatter ?? {},
      });
    }
  })();

  const client: NotesClient = {
    async getNote({ id }) {
      const n = notes.get(id);
      if (!n) throw new NotesError("not_found", `Note ${id} not found`);
      return structuredClone(n);
    },

    async searchNotes(req: SearchNotesRequest) {
      let items = [...notes.values()].filter((n) => matches(n, req));
      if (req.before) {
        const before = req.before;
        items = items.filter((n) =>
          isDateToken(before) ? n.createdAt < before : n.id < before,
        );
      }
      items.sort(
        (a, b) =>
          compareCodePoints(b.createdAt, a.createdAt) ||
          compareCodePoints(b.id, a.id),
      );
      if (req.limit) items = items.slice(0, req.limit);
      return {
        items: items.map((n) => ({
          id: n.id,
          journalId: n.journalId,
          title: n.title,
          createdAt: n.createdAt,
        })),
      };
    },

    async countNotes(q) {
      return { count: [...notes.values()].filter((n) => matches(n, q)).length };
    },

    async createNote(req: CreateNoteRequest) {
      requireJournal(req.journalId, "invalid_input");
      const now = new Date().toISOString();
      const createdAt = req.createdAt ?? now;
      const note = await store({
        id: newId(),
        journalId: req.journalId,
        title: req.title ?? null,
        content: req.content,
        tags: req.tags ?? [],
        createdAt,
        updatedAt: req.createdAt ?? now,
        frontMatter: req.frontMatter ?? {},
      });
      return { id: note.id, revision: note.revision };
    },

    async updateNote(req: UpdateNoteRequest) {
      const existing = notes.get(req.id);
      if (!existing) {
        throw new NotesError("not_found", `Note ${req.id} not found`);
      }
      if (
        req.baseRevision !== undefined &&
        req.baseRevision !== existing.revision
      ) {
        throw new NotesError(
          "conflict",
          `Note ${req.id} changed since revision ${req.baseRevision}`,
        );
      }
      requireJournal(req.journalId, "invalid_input");
      const note = await store({
        id: req.id,
        journalId: req.journalId,
        title: req.title ?? null,
        content: req.content,
        tags: req.tags,
        createdAt: req.createdAt ?? existing.createdAt,
        updatedAt: req.updatedAt ?? new Date().toISOString(),
        frontMatter: req.frontMatter ?? {},
      });
      return { id: note.id, revision: note.revision };
    },

    async deleteNote({ id }) {
      notes.delete(id);
    },

    async listJournals() {
      return {
        journals: [...journals.values()]
          .sort((a, b) => compareCodePoints(a.name, b.name))
          .map(toJournal),
      };
    },

    async createJournal({ name }) {
      name = validName(name);
      const existing = journalByName(name);
      if (existing) {
        throw new NotesError(
          "conflict",
          `Journal "${existing.name}" already exists.`,
        );
      }
      const j = { id: newId(), name, archived: false };
      journals.set(j.id, j);
      return toJournal(j);
    },

    async renameJournal({ id, name }) {
      const j = requireJournal(id, "not_found");
      name = validName(name);
      const existing = journalByName(name);
      if (existing && existing.id !== id) {
        throw new NotesError(
          "conflict",
          `Journal "${existing.name}" already exists.`,
        );
      }
      j.name = name;
      return toJournal(j);
    },

    async setJournalArchived({ id, archived }) {
      const j = requireJournal(id, "not_found");
      if (archived && journals.size === 1) {
        throw new NotesError(
          "invalid_input",
          "Cannot archive the last journal. Create a new journal first.",
        );
      }
      j.archived = archived;
      return toJournal(j);
    },

    async deleteJournal({ id }) {
      requireJournal(id, "not_found");
      if (journals.size === 1) {
        throw new NotesError(
          "invalid_input",
          "Cannot delete the last journal. Create a new journal first.",
        );
      }
      for (const n of [...notes.values()]) {
        if (n.journalId === id) notes.delete(n.id);
      }
      journals.delete(id);
    },

    async listTags() {
      const counts = new Map<string, number>();
      for (const n of notes.values()) {
        for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      return {
        tags: [...counts]
          .sort(([a], [b]) => compareCodePoints(a, b))
          .map(([tag, count]) => ({ tag, count })),
      };
    },

    async bulkUpdate({ query, op }) {
      const tag = op.type === "change_journal" ? null : op.tag.trim();
      if (tag === "") throw new NotesError("invalid_input", "Tag is empty");
      if (op.type === "change_journal") {
        requireJournal(op.journalId, "invalid_input");
      }
      const matched = [...notes.values()].filter((n) => matches(n, query));
      for (const n of matched) {
        await store({
          ...n,
          journalId: op.type === "change_journal" ? op.journalId : n.journalId,
          tags:
            op.type === "add_tag"
              ? [...n.tags, tag!]
              : op.type === "remove_tag"
                ? n.tags.filter((t) => t !== tag)
                : n.tags,
        });
      }
      return { matched: matched.length, updated: matched.length, failed: [] };
    },

    async putAttachment({ bytes, name }) {
      const m = name.match(/(\.[A-Za-z0-9]+)$/);
      const ext = m ? m[1].toLowerCase() : "";
      const hash = await sha256(bytes);
      attachments.set(hash + ext, bytes);
      return {
        url: `chronicles://attachment/${hash}${ext}`,
        sha256: hash,
        ext,
      };
    },
  };

  return Object.assign(client, { ready });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
