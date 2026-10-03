import { compareCodePoints } from "../contract/canonical";
import {
  NotesError,
  type Journal,
  type NoteQuery,
  type NotesClient,
} from "../contract/notes";
import type { SearchRequest } from "../preload/client/types";
import type { AttachmentStore } from "./attachments";
import type { DocumentsClient } from "./documents";
import type { JournalsClient, JournalWithCount } from "./journals";
import type { TagsClient } from "./tags";

/**
 * NotesClient over the DB-first Node services. A thin translation layer:
 * journal ids ↔ names (the services are still name-based), request shapes,
 * and `[CODE]`-prefixed errors → NotesError codes.
 */
export function createNodeNotesClient(deps: {
  documents: DocumentsClient;
  journals: JournalsClient;
  tags: TagsClient;
  attachments: AttachmentStore;
}): NotesClient {
  const { documents, journals, tags, attachments } = deps;

  const allJournals = () => journals.listWithCounts();
  const toJournal = (j: JournalWithCount): Journal => ({
    id: j.id,
    name: j.name,
    archived: j.archived,
    noteCount: j.count,
  });

  async function journalById(
    id: string,
    code: "not_found" | "invalid_input" = "not_found",
  ) {
    const j = (await allJournals()).find((j) => j.id === id);
    if (!j) throw new NotesError(code, `Journal ${id} not found`);
    return j;
  }

  async function namesFor(ids: string[] | undefined) {
    if (!ids?.length) return undefined;
    const all = await allJournals();
    // An unknown id must match nothing, not be dropped (which would widen
    // the query); journal names can't contain "/".
    return ids.map((id) => all.find((j) => j.id === id)?.name ?? `/${id}`);
  }

  async function toSearchRequest(q: NoteQuery): Promise<SearchRequest> {
    const req: SearchRequest = {
      journals: await namesFor(q.journalIds),
      tags: q.tags,
      titles: q.titles,
      texts: q.texts,
      date: q.date,
    };
    const exclude = {
      journals: await namesFor(q.excludeJournalIds),
      tags: q.excludeTags,
    };
    if (exclude.journals || exclude.tags) req.exclude = exclude;
    return req;
  }

  /** Run `fn`, translating service errors into NotesErrors. */
  async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw toNotesError(err);
    }
  }

  return {
    getNote: ({ id }) =>
      call(async () => {
        const doc = await documents.findById({ id });
        const journal = (await allJournals()).find(
          (j) => j.name === doc.journal,
        )!;
        const { title, tags, createdAt, updatedAt, ...frontMatter } =
          doc.frontMatter;
        return {
          id: doc.id,
          journalId: journal.id,
          title: title ?? null,
          content: doc.content,
          tags: [...tags].sort(compareCodePoints),
          createdAt,
          updatedAt,
          frontMatter,
          revision: doc.revision,
        };
      }),

    searchNotes: (req) =>
      call(async () => {
        const all = await allJournals();
        const result = await documents.search({
          ...(await toSearchRequest(req)),
          before: req.before,
          limit: req.limit,
        });
        return {
          items: result.data.map((d) => ({
            id: d.id,
            journalId: all.find((j) => j.name === d.journal)!.id,
            title: d.title ?? null,
            createdAt: d.createdAt,
          })),
        };
      }),

    countNotes: (q) =>
      call(async () => ({
        count: await documents.searchCount(await toSearchRequest(q)),
      })),

    createNote: (req) =>
      call(async () => {
        const journal = await journalById(req.journalId, "invalid_input");
        const createdAt = req.createdAt ?? new Date().toISOString();
        const id = await documents.createDocument({
          journal: journal.name,
          content: req.content,
          frontMatter: {
            ...req.frontMatter,
            title: req.title ?? undefined,
            tags: req.tags ?? [],
            createdAt,
            updatedAt: createdAt,
          },
        });
        const { revision } = await documents.findById({ id });
        return { id, revision };
      }),

    updateNote: (req) =>
      call(async () => {
        const existing = await documents.findById({ id: req.id });
        const journal = await journalById(req.journalId, "invalid_input");
        const revision = await documents.updateDocument({
          id: req.id,
          baseRevision: req.baseRevision,
          journal: journal.name,
          content: req.content,
          frontMatter: {
            ...req.frontMatter,
            title: req.title ?? undefined,
            tags: req.tags,
            createdAt: req.createdAt ?? existing.frontMatter.createdAt,
            updatedAt: req.updatedAt ?? new Date().toISOString(),
          },
        });
        return { id: req.id, revision };
      }),

    deleteNote: ({ id }) => call(() => documents.del(id)),

    listJournals: () =>
      call(async () => ({
        journals: (await allJournals())
          .sort((a, b) => compareCodePoints(a.name, b.name))
          .map(toJournal),
      })),

    createJournal: ({ name }) =>
      call(async () => {
        const created = await journals.create({ name });
        return toJournal({ ...created, count: 0 });
      }),

    renameJournal: ({ id, name }) =>
      call(async () => {
        const j = await journalById(id);
        await journals.rename(j, name);
        return toJournal(await journalById(id));
      }),

    setJournalArchived: ({ id, archived }) =>
      call(async () => {
        const j = await journalById(id);
        if (archived) await journals.archive(j.name);
        else await journals.unarchive(j.name);
        return toJournal(await journalById(id));
      }),

    deleteJournal: ({ id }) =>
      call(async () => {
        const j = await journalById(id);
        await journals.remove(j.name);
      }),

    listTags: () => call(async () => ({ tags: await tags.allWithCounts() })),

    putAttachment: ({ bytes, name }) =>
      call(async () => {
        const stored = await attachments.putBytes(bytes, {
          ext: name.match(/(\.[A-Za-z0-9]+)$/)?.[1] ?? "",
          originalName: name,
        });
        return { url: stored.url, sha256: stored.sha256, ext: stored.ext };
      }),
  };
}

/** Map a service error to a contract error. */
export function toNotesError(err: unknown): NotesError {
  if (err instanceof NotesError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/^\[(DOCUMENT|JOURNAL)_NOT_FOUND\]/.test(message)) {
    return new NotesError("not_found", message);
  }
  if (message.startsWith("[DOCUMENT_CONFLICT]")) {
    return new NotesError("conflict", message);
  }
  if (/already exists/.test(message)) {
    return new NotesError("conflict", message);
  }
  if (/^Journal name|^Cannot (archive|delete) the last journal/.test(message)) {
    return new NotesError("invalid_input", message);
  }
  return new NotesError("unavailable", message);
}
