import { debounce } from "lodash";
import { IReactionDisposer, computed, observable, reaction, toJS } from "mobx";
import { toast } from "sonner";
import { IClient } from "../../hooks/useClient";
import { slateToMdast, slateToString, stringToSlate } from "../../markdown";
import * as SlateCustom from "../../markdown/remark-slate-transformer/transformers/mdast-to-slate";
import { FrontMatter, GetDocumentResponse } from "../../preload/client/types";

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
  @observable saving: boolean = false;
  @observable savingError: Error | null = null;

  /**
   * The markdown string, i.e. after converting Slate DOM content
   * to a string for saving, its stored here.
   */
  @observable content: string = "";

  /**
   * For debugging how slate DOM is converted to MDAST. See save.
   * NOTE: This is computed so its only computed when called by the
   * debug view.
   */
  @computed get mdastDebug() {
    const slateContent = this.getInitialSlateContent();
    if (slateContent) {
      return slateToMdast(toJS(slateContent));
    } else {
      return "No EditableDocument.slateContent not yet set.";
    }
  }

  // The underlying document properties:
  @observable title?: string;
  @observable journal: string;
  @observable id: string;
  @observable createdAt: string;
  @observable updatedAt: string; // read-only outside this class
  @observable tags: string[];
  @observable frontMatter: FrontMatter;

  // editor properties
  slateContent: SlateCustom.SlateNode[] = [];

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
    this.createdAt = doc.frontMatter.createdAt;
    this.updatedAt = doc.frontMatter.updatedAt;
    this.tags = doc.frontMatter.tags;
    this.frontMatter = doc.frontMatter;

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
        this.save("frontmatter", undefined);
      },
      // I tried delay here, but it works like throttle.
      // So, I put a debounce on save instead
    );
  }

  getInitialContent = () => {
    return this.content;
  };

  getInitialSlateContent = () => {
    const slateNodes = stringToSlate(this.content);
    this.slateContent = slateNodes;
    return slateNodes;
  };

  /**
   * Updates the Slate DOM content.
   * This is used by the WYSIWYG editor.
   */
  setSlateContent = (nodes: SlateCustom.SlateNode[]) => {
    // NOTE: This is called when the cursor moves, but the content appears to be unchanged
    // It seems like the slate nodes always change if any content changes, so this is
    // hopefully safe :|
    // (if not, people's changes would be unsaved in those cases)
    if (nodes !== this.slateContent) {
      this.slateContent = nodes;
      this.save("slate-dom", nodes);
    }
  };

  /**
   * Updates the raw markdown content directly.
   * This is used by the markdown editor.
   */
  setMarkdownContent = (markdown: string) => {
    if (markdown !== this.content) {
      this.content = markdown;
      this.save("markdown", markdown);
    }
  };

  /**
   * Saves the document to the server.
   * For WYSIWYG editor, it converts the Slate DOM to markdown before saving.
   * For markdown editor, it saves the raw markdown content directly.
   */
  save: {
    (
      type: "frontmatter",
      content: undefined,
    ): Promise<void | undefined> | undefined;
    (
      type: "slate-dom",
      content: SlateCustom.SlateNode[],
    ): Promise<void | undefined> | undefined;
    (type: "markdown", content: string): Promise<void | undefined> | undefined;
  } = debounce(
    async (type, content) => {
      this.saving = true;

      try {
        this.updatedAt = this.frontMatter.updatedAt = new Date().toISOString();
        this.frontMatter.title = this.title;
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

        if (type === "slate-dom") {
          this.content = slateToString(toJS(content));
        } else {
          this.content = content;
        }

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
