import { useState, useEffect } from "react";
import { autorun } from "mobx";

import { withLoading } from "./loadutils";
import { GetDocumentResponse } from "../client";
import { useClient } from "../client/context";
import { useJournal } from "./useJournal";
import { IJournal } from "../api/journals";
import { DateTime } from "luxon";

interface DocumentLoadedState {
  error: null;
  loading: false;
  document: GetDocumentResponse;
}

interface DocumentLoadingState {
  error: null;
  loading: true;
  document: null;
}

/**
 * The document failed to load because of an error.
 */
interface DocumentErrorState {
  error: Error;
  loading: false;
  document: null;
}

/**
 * A document request (really, any request) can actually be only one of
 * these discrete states.
 *
 * 1. Loading: Document is loading
 * 2. Error: Document failed to load
 * 3. Loaded: Document loaded succesfully (is now non-null)
 */
export type DocumentState =
  | DocumentLoadedState
  | DocumentLoadingState
  | DocumentErrorState;

/**
 * Options to useDocument
 */
type UseDocumentOpts = {
  /**
   * Should it return an empty document on 404, or propagate the error?
   */
  isCreate: true;
  /**
   * A key that, when changed, will cause the load effect to re-run
   * Kind of stupid but, works for MVP
   */
  refresh: boolean;
  consumer?: string;
};

export function useDocument(
  journal: string,
  date: string,
  opts: Partial<UseDocumentOpts> = {}
) {
  const client = useClient();
  const [record] = useState(
    client.cache.loadDocument({
      journalName: journal,
      date,
      isCreate: opts.isCreate,
    })
  );

  return record;
}

import { Node } from "slate";

/**
 * The "New document" button needs to know what date today is.
 */
function getToday() {
  const d = new Date();
  // This isn't quite right. At 6:30 am, this makes a date
  // that is 00:30. setUTCHours is stranger. TODO: Revisit
  d.setHours(-d.getTimezoneOffset() / 60);
  return d.toISOString().slice(0, 10);
}

/**
 * The Slate editor uses nodes for its state.
 *
 * These are hacky to get it rolling, not sure what the state is supposed
 * to look like.
 */
class EditHelper {
  static stringify(node: Node[]) {
    return node.map((n: any) => Node.string(n)).join("\n");
  }

  static nodify(contents?: string) {
    return [{ children: [{ text: contents || "" }] }];
  }

  // This is an example deserializer from the Slate docs
  // May need this for copy and paste hmmm..
  static nodify2(contents?: string) {
    if (!contents) return [{ children: [{ text: "" }] }];

    return contents.split("\n").map((line) => {
      children: [{ text: line }];
    });
  }
}

/**
 * When creating a new entry, get the latest date for a given journal.
 * day - today
 * week - the start of this week
 * month - the start of this month
 * ...
 *
 * TODO: Should this logic be in the API? The future client library?
 * @param unit
 */
function getLatestDate(unit: IJournal["unit"]): string {
  switch (unit) {
    case "day":
      return getToday();
    case "week":
      return DateTime.local().startOf("week").toISODate()!;
    case "month":
      return DateTime.local().startOf("month").toISODate()!;
    case "year":
      return DateTime.local().startOf("year").toISODate()!;
    default:
      throw new Error(`getLatestDate called with unknown date type ${unit}`);
  }
}

/**
 * This is how the editor gets a handle on a document which may be edited.
 *
 * @param journal - Name of journal this document belongs to
 * @param date  - Specify a date. But... depends on unit of the journal of course. Kind of...
 * @param isUsing  - Spilling modal details into this hook. Great.
 */
export function useEditableDocument(
  journalName: string,
  date?: string,
  isUsing?: boolean
) {
  const client = useClient();
  const journal = useJournal(journalName);
  const [dateToUse] = useState(date || getLatestDate(journal.unit));

  // this is safe to run on every render
  // TODO: Add validation in useDocument to protect against wrong date?
  // Or just rely on the API to do that?
  const doc = useDocument(journalName, dateToUse, {
    // todo: Actually -- createIfNotExist
    isCreate: true,
    refresh: isUsing,
  });

  // Editor gets a copy of the documents contents.
  const [value, setValue] = useState<Node[]>(EditHelper.nodify(doc?.data?.raw));
  const [isDirty, setDirty] = useState(false);

  const setEditorValue = (v: Node[]) => {
    setDirty(true);
    setValue(v);
  };

  // once document is loaded... need to set value...
  useEffect(() => {
    const dispoable = autorun(() => {
      // may also need to ensure this only runs...
      // not when saving... it shouldnt'
      if (!doc.loading && doc.data) {
        setValue(EditHelper.nodify(doc.data.raw));
      }
    });

    return dispoable;
  }, [journal, date]);

  // todo: this whole wrapper business is confusing
  const saveDocumentBase = async () => {
    await client.cache.saveDocument({
      date: dateToUse,
      journalName,
      // todo: this is duplicated from document.tsx
      raw: EditHelper.stringify(value),
    });
    setDirty(false);
  };

  const {
    wrapper: saveDocument,
    ...savingState
  } = withLoading(saveDocumentBase, { defaultLoading: false, propagate: true });

  return {
    doc,
    date: dateToUse,
    value,
    setValue: setEditorValue,
    isDirty,
    saveDocument: saveDocumentBase,
    savingState,
  };
}
