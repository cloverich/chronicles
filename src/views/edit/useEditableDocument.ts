import React from "react";
import { JournalResponse } from "../../api/client/journals";
import { GetDocumentResponse } from "../../api/client/documents";
import { pick } from "lodash";
import { observable, autorun, toJS, computed } from "mobx";
import { toaster } from "evergreen-ui";
import client, { Client } from "../../client";
import { Node as SlateNode } from "slate";
import { SlateTransformer, stringToMdast } from "./util";
import { Root as MDASTRoot } from "mdast";

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
    return !!this.id;
  }

  // todo: Autorun this, or review how mobx-utils/ViewModel works
  @observable dirty: boolean = false;

  // document properties:
  @observable content: string = "";
  @observable title?: string;
  @observable journalId: string;
  @observable id?: string;
  @observable createdAt: string;
  readonly updatedAt: string;

  // editor properties
  @observable slateContent: SlateNode[];

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
  }

  // todo: all properties need a setter (dirty tracking) OR need autorun
  setSlateContent = (nodes: SlateNode[]) => {
    this.slateContent = nodes;
    this.dirty = true;
  };

  save = async () => {
    if (this.saving) return;

    this.saving = true;
    this.content = SlateTransformer.stringify(toJS(this.slateContent));

    try {
      // note: I was passing documentId instead of id, and because id is optional in save it wasn't complaining.
      // Maybe 'save' and optional, unvalidated params is a bad idea :|
      const res = await this.client.v2.documents.save(
        pick(toJS(this), "title", "content", "journalId", "id", "createdAt")
      );
      this.id = res.id;
    } catch (err) {
      this.saving = false;
      toaster.danger(JSON.stringify(err));
    } finally {
      this.saving = false;
    }
  };
}

// todo: consolidate with existing useJournals hooks once that's refactored
export function useJournals() {
  const [journals, setJournals] = React.useState<JournalResponse[] | null>(
    null
  );
  const [loadingError, setloadingError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let isEffectMounted = true;
    async function load() {
      try {
        const journals = await client.v2.journals.list();
        if (!isEffectMounted) return;
        setJournals(journals);
      } catch (err) {
        if (!isEffectMounted) return;
        setloadingError(err as Error);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, []);

  return { journals, loadingError };
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

  // (Re)load document based on documentId
  React.useEffect(() => {
    let isEffectMounted = true;
    async function load() {
      setLoadingError(null);

      try {
        // if documentId -> This is an existing document
        if (documentId) {
          const doc = await client.v2.documents.findById({ documentId });
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
    };
  }, [documentId]);

  return {
    journals,
    document,
    loadingError: loadingError,
  };
}
