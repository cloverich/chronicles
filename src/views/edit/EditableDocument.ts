import { debounce } from "lodash";
import {
  IReactionDisposer,
  makeObservable,
  observable,
  reaction,
  toJS,
} from "mobx";
import { toast } from "sonner";
import type { IClient } from "../../hooks/useClient";
import type {
  FrontMatter,
  GetDocumentResponse,
} from "../../preload/client/types";

function isExistingDocument(
  doc: GetDocumentResponse,
): doc is GetDocumentResponse {
  return "id" in doc;
}

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
  journal: string;
  id: string;
  filepath: string;
  createdAt: string;
  updatedAt: string; // read-only outside this class
  tags: string[];
  frontMatter: FrontMatter;

  // todo: save queue. I'm saving too often, but need to do this until I allow exiting note
  // while save is in progress; track and report saveCount to discover if this is a major issue
  // or not.
  saveCount = 0;

  // reaction clean-up when component unmounts; see constructor
  teardown?: IReactionDisposer;

  constructor(
    private client: IClient,
    doc: GetDocumentResponse,
  ) {
    this.title = doc.frontMatter.title;
    this.journal = doc.journal;
    this.content = doc.content;
    this.id = doc.id;
    this.filepath = doc.filepath;
    this.createdAt = doc.frontMatter.createdAt;
    this.updatedAt = doc.frontMatter.updatedAt;
    this.tags = doc.frontMatter.tags;
    this.frontMatter = doc.frontMatter;

    makeObservable(this, {
      saving: observable,
      savingError: observable,
      content: observable,
      title: observable,
      journal: observable,
      id: observable,
      filepath: observable,
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
          journal: this.journal,
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
        this.updatedAt = this.frontMatter.updatedAt = new Date().toISOString();
        this.frontMatter.title = this.title;
        this.frontMatter.createdAt = this.createdAt;
        this.frontMatter.tags = this.tags;

        // todo: if we stay on this route, just make a separate saveFrontMatter method...
        if (type === "frontmatter") {
          await this.client.documents.updateDocument(
            toJS({
              journal: this.journal,
              content: this.content,
              id: this.id,
              frontMatter: toJS(this.frontMatter),
            }),
          );
          this.saveCount++;

          return;
        }

        this.content = content;

        // todo: is toJS necessary here, i.e. copying this.journal to journal, loses Proxy or not?
        // todo: use mobx viewmodel over GetDocumentResponse; track frontMatter properties directly rather
        // than copying back and forth
        await this.client.documents.updateDocument(
          toJS({
            journal: this.journal,
            content: this.content,
            id: this.id,
            frontMatter: toJS(this.frontMatter),
          }),
        );
        this.saveCount++;
      } catch (err) {
        this.saving = false;
        console.error("Error saving document", err);
        toast.error(JSON.stringify(err));
      } finally {
        this.saving = false;
      }
    },
    1000,
    { trailing: true },
  );

  /**
   * Deletes the document from the server.
   */
  del = async () => {
    // overload saving for deleting
    this.saving = true;
    await this.client.documents.del(this.id, this.journal);
  };
}
