import React from "react";
import { JournalResponse } from "../../api/client/journals";
import { GetDocumentResponse } from "../../api/client/documents";
import { pick } from "lodash";
import { observable, autorun, toJS } from "mobx";
import { toaster } from "evergreen-ui";
import client, { Client } from "../../client";
import { Node } from "slate";
import { SlateTransformer, stringToMdast } from "./util";
import { Root as MDASTRoot } from "mdast";

interface NewDocument {
  journalId: string;
  content: string;
  title?: string;
}

// View model for tracking save state of a loaded document
class EditableDocument {
  @observable saving: boolean = false;
  @observable content: string = "";
  @observable title?: string;
  @observable journalId: string;
  @observable id?: string;

  constructor(private client: Client, doc: NewDocument | GetDocumentResponse) {
    this.title = doc.title;
    this.journalId = doc.journalId;

    // idk why it bitches about this
    if ("id" in doc) {
      this.id = doc.id;
    }

    this.content = doc.content;
  }

  save = async (nodes: Node[]) => {
    if (this.saving) return;

    this.saving = true;
    this.content = SlateTransformer.stringify(nodes);

    try {
      // note: I was passing documentId instead of id, and because id is optional in save it wasn't complaining.
      // Maybe 'save' and optional, unvalidated params is a bad idea :|
      const res = await this.client.v2.documents.save(
        pick(this, "title", "content", "journalId", "id")
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

export function useEditableDocument(documentId: string) {
  // Editor gets a copy of the documents contents.
  const [slateContent, setSlateContent] = React.useState<Node[]>(
    SlateTransformer.createEmptyNodes()
  );
  const [docState, setDocState] = React.useState<EditableDocument>();

  // Track whether save is enabled, and (todo) whether navigation should warn
  const [isDirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);

  // For debugging, save the original text and conversions
  const [rawOriginal, setRawOriginal] = React.useState("");
  const [mdastOriginal, setMdastOriginal] = React.useState<MDASTRoot>();
  const [slateOriginal, setSlateOriginal] = React.useState<any>();

  const setEditorValue = (v: Node[]) => {
    setDirty(true);
    setSlateContent(v);
  };

  const save = async () => {
    docState?.save(slateContent);
  };

  // (Re)load document based on documentId
  React.useEffect(() => {
    let isEffectMounted = true;
    async function load() {
      setLoadingErr(null);

      try {
        const doc = await client.v2.documents.findById({ documentId });
        if (!isEffectMounted) return;

        setDocState(new EditableDocument(client, doc));

        // note: I can't remember if I _needed_ to call toJS here...
        const content = toJS(doc.content);
        const slateNodes = SlateTransformer.nodify(content);
        setSlateContent(slateNodes);
        setSlateOriginal(slateNodes);
        setRawOriginal(content);
        setMdastOriginal(stringToMdast.parse(content) as MDASTRoot);
        setDirty(false);
        setLoading(false);
      } catch (err) {
        if (!isEffectMounted) return;
        setLoadingErr(err);
        setLoading(false);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, [documentId]);

  return {
    setEditorValue,
    slateContent,
    save,
    isDirty,
    loading,
    loadingErr,
    docState,
    initialState: {
      raw: rawOriginal,
      slate: slateOriginal,
      mdast: mdastOriginal,
    },
  };
}

export function useNewEditableDocument() {
  // Editor gets a copy of the documents contents.
  const [slateContent, setSlateContent] = React.useState<Node[]>(
    SlateTransformer.createEmptyNodes()
  );
  const [docState, setDocState] = React.useState<EditableDocument>();

  // Track whether save is enabled, and (todo) whether navigation should warn
  // todo: auto-save simplifies this
  const [isDirty, setDirty] = React.useState(false);

  const [journals, setJournals] = React.useState<JournalResponse[]>();
  const [loading, setLoading] = React.useState(true);
  const [loadingErr, setLoadingErr] = React.useState(null);

  React.useEffect(() => {
    let isEffectMounted = true;
    setLoading(true);

    async function load() {
      try {
        const journals = await client.v2.journals.list();
        if (!isEffectMounted) return;

        setJournals(journals);
        setDocState(
          new EditableDocument(client, {
            content: "",
            journalId: journals[0].id,
          })
        );
        setDirty(false);
        setLoading(false);
      } catch (err) {
        if (!isEffectMounted) return;

        setLoadingErr(err);
        setLoading(false);
      }
    }

    load();
    return () => {
      isEffectMounted = false;
    };
  }, []);

  const setEditorValue = (v: Node[]) => {
    setDirty(true);
    setSlateContent(v);
  };

  const save = async () => {
    docState?.save(slateContent);
  };

  return {
    setEditorValue,
    slateContent,
    save,
    journals,
    isDirty,
    loading,
    loadingErr,
    docState,
  };
}
