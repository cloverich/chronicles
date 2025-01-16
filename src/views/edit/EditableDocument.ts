import { debounce } from "lodash";
import { IReactionDisposer, computed, observable, reaction, toJS } from "mobx";
import { toast } from "sonner";
import { IClient } from "../../hooks/useClient";
import * as SlateCustom from "../../markdown/remark-slate-transformer/transformers/mdast-to-slate";
import { FrontMatter, GetDocumentResponse } from "../../preload/client/types";
import { SlateTransformer } from "./SlateTransformer";

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

  // todo: Autorun this, or review how mobx-utils/ViewModel works
  @observable dirty: boolean = false;

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
    if (this.slateContent) {
      return SlateTransformer.mdastify(toJS(this.slateContent));
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
  slateContent: SlateCustom.SlateNode[];
  @observable private changeCount = 0;

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
    const content = doc.content;
    const slateNodes = SlateTransformer.nodify(content);
    this.slateContent = slateNodes;

    // Auto-save
    // todo: performance -- investigate putting draft state into storage,
    // and using a webworker to do the stringify and save step
    this.teardown = reaction(
      () => {
        return {
          createdAt: this.createdAt,
          // Watch a counter instead of content, so I don't have to wrap and unwrap
          // the underlying nodes. See setSlateContent for additional context.
          changeCount: this.changeCount,
          title: this.title,
          journal: this.journal,
          tags: this.tags.slice(), // must access elements to watch them
        };
      },
      () => {
        this.dirty = true;
        this.save();
      },
      // I tried delay here, but it works like throttle.
      // So, I put a debounce on save instead
    );
  }

  setSlateContent = (nodes: SlateCustom.SlateNode[]) => {
    // NOTE: This is called when the cursor moves, but the content appears to be unchanged
    // It seems like the slate nodes always change if any content changes, so this is
    // hopefully safe :|
    // (if not, people's changes would be unsaved in those cases)
    if (nodes !== this.slateContent) {
      this.slateContent = nodes;
      this.changeCount++;
    }
  };

  save = debounce(
    async () => {
      if (this.saving || !this.dirty) return;
      this.saving = true;

      // note: Immediately reset dirty so if edits happen while (auto) saving,
      // it can call save again on completion
      // Error case is kind of hacky but unlikely an issue in practice
      this.dirty = false;

      this.content = SlateTransformer.stringify(toJS(this.slateContent));
      let wasError = false;

      try {
        this.updatedAt = this.frontMatter.updatedAt = new Date().toISOString();
        this.frontMatter.title = this.title;
        this.frontMatter.tags = this.tags;

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
        this.dirty = true;
        wasError = true;
        console.error("Error saving document", err);
        toast.error(JSON.stringify(err));
      } finally {
        this.saving = false;

        // if edits made after last save attempt, re-run
        // Check error to avoid infinite save loop
        if (this.dirty && !wasError) this.save();
      }
    },
    1000,
    { trailing: true },
  );

  del = async () => {
    // overload saving for deleting
    this.saving = true;
    await this.client.documents.del(this.id, this.journal);
  };
}
