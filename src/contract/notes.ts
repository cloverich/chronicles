/**
 * NotesClient: the platform-neutral contract between the Chronicles UI and
 * whatever hosts it (Electron preload, a Swift WKWebView bridge, an in-memory
 * reference). Spec: `spec/notes-client.md`; behavior is pinned by the fixtures
 * in `spec/vectors/contract/`, which are the source of truth.
 *
 * Runtime-free: no Node, Electron, Drizzle, or filesystem types. Every
 * operation takes one request object and returns a promise. Failures reject
 * with a `NotesError` carrying a stable `code`.
 */

// ---------- errors ----------

export const NOTES_ERROR_CODES = [
  "not_found",
  "conflict",
  "invalid_input",
  "unsupported",
  "unavailable",
] as const;

export type NotesErrorCode = (typeof NOTES_ERROR_CODES)[number];

export class NotesError extends Error {
  constructor(
    readonly code: NotesErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NotesError";
  }
}

/** True for a NotesError, including one that crossed a structured-clone boundary. */
export function isNotesError(err: unknown): err is NotesError {
  return (
    !!err &&
    typeof err === "object" &&
    NOTES_ERROR_CODES.includes((err as NotesError).code)
  );
}

// ---------- entities ----------

export type Timestamp = string;

/** A note as stored. References in `content` are in stored form. */
export interface Note {
  id: string;
  journalId: string;
  title: string | null;
  content: string;
  /** Unique, sorted by code point. */
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** User frontmatter keys only (never id/title/journal/timestamps/tags). */
  frontMatter: Record<string, unknown>;
  /** Pass back as `baseRevision` when updating. */
  revision: string;
}

export interface NoteSummary {
  id: string;
  journalId: string;
  title: string | null;
  createdAt: Timestamp;
}

export interface Journal {
  id: string;
  name: string;
  archived: boolean;
  /** Number of notes in the journal. */
  noteCount: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

// ---------- requests ----------

export interface GetNoteRequest {
  id: string;
}

export interface NoteQuery {
  /** Only these journals (by id). */
  journalIds?: string[];
  excludeJournalIds?: string[];
  /** Notes having any of these tags. */
  tags?: string[];
  /** Notes having none of these tags. */
  excludeTags?: string[];
  /** Title contains each of these (case-insensitive). */
  titles?: string[];
  /** Full-text terms; a note must match all. */
  texts?: string[];
  /** createdAt starts with this `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  date?: string;
}

export interface SearchNotesRequest extends NoteQuery {
  /** Only notes created before this date (`YYYY[-MM[-DD]]`) or note id. */
  before?: string;
  limit?: number;
}

export interface CreateNoteRequest {
  journalId: string;
  title?: string | null;
  content: string;
  tags?: string[];
  frontMatter?: Record<string, unknown>;
  /** Defaults to now. Also the default `updatedAt`. */
  createdAt?: Timestamp;
}

export interface UpdateNoteRequest {
  id: string;
  /** When given and stale, the update fails with `conflict`. */
  baseRevision?: string;
  journalId: string;
  title?: string | null;
  content: string;
  tags: string[];
  frontMatter?: Record<string, unknown>;
  createdAt?: Timestamp;
  /** Defaults to now. */
  updatedAt?: Timestamp;
}

export interface PutAttachmentRequest {
  bytes: Uint8Array;
  /** Original file name; its extension becomes the attachment's. */
  name: string;
}

// ---------- responses ----------

export interface SearchNotesResponse {
  /** Newest first (createdAt descending). */
  items: NoteSummary[];
}

export interface WriteNoteResponse {
  id: string;
  revision: string;
}

export interface PutAttachmentResponse {
  /** `chronicles://attachment/<sha256><ext>` */
  url: string;
  sha256: string;
  ext: string;
}

// ---------- the client ----------

export interface NotesClient {
  getNote(req: GetNoteRequest): Promise<Note>;
  searchNotes(req: SearchNotesRequest): Promise<SearchNotesResponse>;
  countNotes(req: NoteQuery): Promise<{ count: number }>;
  createNote(req: CreateNoteRequest): Promise<WriteNoteResponse>;
  updateNote(req: UpdateNoteRequest): Promise<WriteNoteResponse>;
  deleteNote(req: { id: string }): Promise<void>;

  listJournals(): Promise<{ journals: Journal[] }>;
  createJournal(req: { name: string }): Promise<Journal>;
  renameJournal(req: { id: string; name: string }): Promise<Journal>;
  setJournalArchived(req: { id: string; archived: boolean }): Promise<Journal>;
  deleteJournal(req: { id: string }): Promise<void>;

  listTags(): Promise<{ tags: TagCount[] }>;

  putAttachment(req: PutAttachmentRequest): Promise<PutAttachmentResponse>;
}

/** Operation names, for bridges that dispatch by name. */
export type NotesOperation = keyof NotesClient;
