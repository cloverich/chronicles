import React from "react";
import { JournalResponse } from "../../preload/client/journals";
import { GetDocumentResponse } from "../../preload/client/documents";
import { pick } from "lodash";
import { observable, reaction, toJS, computed, IReactionDisposer } from "mobx";
import { toaster } from "evergreen-ui";
import useClient, { Client } from "../../hooks/useClient";
import { Node as SlateNode } from "slate";
import { SlateTransformer } from "./util";
import { debounce } from "lodash";

interface NewDocument {
  journalId: string;
  content: string;
  title?: string;
}

function isExistingDocument(
  doc: NewDocument | GetDocumentResponse
): doc is GetDocumentResponse {
  return "id" in doc;
}

// View model for tracking save state of a loaded document
export class EditableDocument {
  // active model properties:
  @observable saving: boolean = false;
  @observable savingError: Error | null = null;
  @computed get isNew(): boolean {
    return !this.id;
  }

  // todo: Autorun this, or review how mobx-utils/ViewModel works
  @observable dirty: boolean = false;

  // document properties:
  @observable content: string = "";
  @observable title?: string;
  @observable journalId: string;
  @observable id?: string;
  @observable createdAt: string;
  @observable updatedAt: string; // read-only outside this class

  // editor properties
  slateContent: SlateNode[];
  @observable private changeCount = 0;
  // reaction clean-up when component unmounts
  teardown?: IReactionDisposer;

  constructor(private client: Client, doc: NewDocument | GetDocumentResponse) {
    this.title = doc.title;
    this.journalId = doc.journalId;
    this.content = doc.content;

    if (isExistingDocument(doc)) {
      this.id = doc.id;
      this.createdAt = doc.createdAt;
      this.updatedAt = doc.updatedAt;
      const content = doc.content;
      const slateNodes = SlateTransformer.nodify(content);
      this.slateContent = slateNodes;
    } else {
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      this.slateContent = SlateTransformer.createEmptyNodes();
    }

    // Auto-save
    // todo: performance -- ingestigate putting draft state into storage,
    // and using a webworker to do the stringify and save step
    this.teardown = reaction(
      () => {
        return {
          createdAt: this.createdAt,
          // Watch a counter instead of content, so I don't have to wrap and unwrap
          // the underlying nodes. See setSlateContent for additional context.
          changeCount: this.changeCount,
          title: this.title,
          journal: this.journalId,
        };
      },
      () => {
        this.dirty = true;
        this.save();
      }
      // I tried delay here, but it works like throttle.
      // So, I put a debounce on save instead
    );
  }

  setSlateContent = (nodes: SlateNode[]) => {
    // NOTE: This is called when the cursor moves, but the content appears to be unchanged
    // It seems like the slate nodes always change if any content changes, so this is
    // hopefully safe :|
    // (if not, people's changes would be unsaved in those cases)
    if (nodes !== this.slateContent) {
      this.slateContent = nodes;
      this.changeCount++;
    }
  };

  save = debounce(async () => {
    if (this.saving || !this.dirty) return;
    this.saving = true;

    // note: Immediately reset dirty so if edits happen while (auto) saving,
    // it can call save again on completion
    // Error case is kind of hacky but unlikely an issue in practice
    this.dirty = false;

    this.content = SlateTransformer.stringify(toJS(this.slateContent));

    try {
      // note: I was passing documentId instead of id, and because id is optional in save it wasn't complaining.
      // Maybe 'save' and optional, unvalidated params is a bad idea :|
      const res = await this.client.documents.save(
        pick(toJS(this), "title", "content", "journalId", "id", "createdAt")
      );
      this.id = res.id;
      this.createdAt = res.createdAt;
      this.updatedAt = res.updatedAt;
    } catch (err) {
      this.saving = false;
      this.dirty = true;
      toaster.danger(JSON.stringify(err));
    } finally {
      this.saving = false;

      // if edits made after last save attempt, re-run
      if (this.dirty) this.save();
    }
  }, 1000);

  @computed get canDelete() {
    return !this.isNew && !this.saving;
  }

  del = async () => {
    // redundant id check to satisfy type checker
    if (!this.canDelete || !this.id) return;

    // overload saving for deleting
    this.saving = true;
    await this.client.documents.del(this.id);
  };
}

/**
 * Load a new or existing document into a view model
 */
export function useEditableDocument(
  journals: JournalResponse[],
  documentId?: string
) {
  const [document, setDocument] = React.useState<EditableDocument | null>(null);
  const [loadingError, setLoadingError] = React.useState<Error | null>(null);
  const client = useClient();

  // (Re)load document based on documentId
  React.useEffect(() => {
    let isEffectMounted = true;
    async function load() {
      setLoadingError(null);

      try {
        // if documentId -> This is an existing document
        if (documentId) {
          const doc = await client.documents.findById({ documentId });
          if (!isEffectMounted) return;
          setDocument(new EditableDocument(client, doc));
        } else {
          // new documents
          setDocument(
            new EditableDocument(client, {
              content: "",
              // todo: defaulting to first journal, but could use logic such as the last selected
              // journal, etc, once that is in place
              journalId: journals[0].id,
            })
          );
        }
      } catch (err) {
        if (!isEffectMounted) return;
        setLoadingError(err as Error);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
      if (document?.teardown) document.teardown();
    };
  }, [documentId]);

  return {
    journals,
    document,
    loadingError: loadingError,
  };
}
