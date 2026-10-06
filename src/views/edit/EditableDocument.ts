import { debounce } from "lodash";
import {
  IReactionDisposer,
  makeObservable,
  observable,
  reaction,
  toJS,
} from "mobx";
import { toast } from "sonner";
import {
  isNotesError,
  type Note,
  type NotesClient,
} from "../../contract/notes";

/**
 * View model for tracking save state of a loaded document
 */
export class EditableDocument {
  // active model properties:
  saving: boolean = false;
  savingError: Error | null = null;

  /**
   * The markdown string content of the document.
   */
  content: string = "";

  // The underlying document properties:
  title?: string;
  journalId: string;
  id: string;
  createdAt: string;
  updatedAt: string; // read-only outside this class
  tags: string[];
  /** User frontmatter keys only. */
  frontMatter: Record<string, unknown>;

  /** Revision of the last load or save; sent as baseRevision. */
  revision: string;
  /** Saves run one at a time so each sees the previous save's revision. */
  private pendingSave: Promise<void> = Promise.resolve();

  // todo: save queue. I'm saving too often, but need to do this until I allow exiting note
  // while save is in progress; track and report saveCount to discover if this is a major issue
  // or not.
  saveCount = 0;

  // reaction clean-up when component unmounts; see constructor
  teardown?: IReactionDisposer;

  constructor(
    private notes: NotesClient,
    doc: Note,
  ) {
    this.title = doc.title ?? undefined;
    this.journalId = doc.journalId;
    this.content = doc.content;
    this.id = doc.id;
    this.createdAt = doc.createdAt;
    this.updatedAt = doc.updatedAt;
    this.tags = doc.tags;
    this.frontMatter = doc.frontMatter;
    this.revision = doc.revision;

    makeObservable(this, {
      saving: observable,
      savingError: observable,
      content: observable,
      title: observable,
      journalId: observable,
      id: observable,
      createdAt: observable,
      updatedAt: observable,
      tags: observable,
      frontMatter: observable,
    });

    // Auto-save
    // todo: performance -- investigate putting draft state into storage,
    // and using a webworker to do the stringify and save step
    this.teardown = reaction(
      () => {
        return {
          createdAt: this.createdAt,
          title: this.title,
          journalId: this.journalId,
          tags: this.tags.slice(), // must access elements to watch them
        };
      },
      () => {
        // I tried delay here, but it works like throttle.
        // So, I put a debounce on save instead
        this.save("frontmatter", undefined);
      },
    );
  }

  getInitialContent = () => {
    return this.content;
  };

  /**
   * Updates the raw markdown content directly.
   * This is used by the markdown editor and the Lexical editor.
   */
  setMarkdownContent = (markdown: string) => {
    if (markdown !== this.content) {
      this.content = markdown;
      this.save("markdown", markdown);
    }
  };

  /**
   * Saves the document to the server.
   */
  save: {
    (
      type: "frontmatter",
      content: undefined,
    ): Promise<void | undefined> | undefined;
    (type: "markdown", content: string): Promise<void | undefined> | undefined;
  } = debounce(
    async (type, content) => {
      this.saving = true;

      try {
        this.updatedAt = new Date().toISOString();

        if (type === "markdown") this.content = content;

        await this.persist();
        this.saveCount++;
      } catch (err) {
        this.saving = false;
        console.error("Error saving document", err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(
          isNotesError(err) && err.code === "conflict"
            ? "This note was changed elsewhere. Reload it before editing; your latest edit was not saved."
            : message,
        );
      } finally {
        this.saving = false;
      }
    },
    1000,
    { trailing: true },
  );

  private persist = (): Promise<void> => {
    const run = async () => {
      const { revision } = await this.notes.updateNote(
        toJS({
          id: this.id,
          baseRevision: this.revision,
          journalId: this.journalId,
          title: this.title ?? null,
          content: this.content,
          tags: this.tags.slice(),
          frontMatter: toJS(this.frontMatter),
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        }),
      );
      this.revision = revision;
    };
    const next = this.pendingSave.then(run, run);
    this.pendingSave = next.catch(() => {});
    return next;
  };

  /**
   * Deletes the document from the server.
   */
  del = async () => {
    // overload saving for deleting
    this.saving = true;
    await this.notes.deleteNote({ id: this.id });
  };
}
