import { ObservableMap, observable } from "mobx";
import { GetDocument, GetDocumentResponse, SaveRequest } from ".";
import ky from "ky-universal";
import { toaster } from "evergreen-ui";
import { Client } from "./";

type WaitingCallback = [(doc: GetDocumentResponse) => any, (err: Error) => any];

// TODO: Would an observable activeRecord make more sense?
interface ActiveRecord<T> {
  loading: boolean;
  saving: boolean;
  error: Error | null;
  data: T | null;
}

type DocRecord = ActiveRecord<GetDocumentResponse>;

export class DocsStore {
  private docs: ObservableMap<string, ActiveRecord<GetDocumentResponse>>;
  private loading: ObservableMap<string, WaitingCallback[]>;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    // todo: no need for observable map
    this.docs = observable.map();
    this.loading = observable.map();
  }

  addWatcher() {}

  clearWatcher() {}

  private asString(req: GetDocument) {
    return `${req.journalName}-${req.date}`;
  }

  private onLoadedOrErr = async (
    waitingCache: string,
    document?: GetDocumentResponse,
    err?: Error | null
  ) => {
    const waiting = this.loading.get(waitingCache);
    // now resolve...
    if (!waiting) {
      throw new Error(
        `docsStore.doTheLoad finished loading, but nobody was waiting in queue ${waitingCache}!`
      );
    }

    // todo: make this methods signature a better type
    if (!document && !err) {
      const err = new Error("onLoadedOrErr invalid state: called with out ");
      console.log(err);
      waiting.forEach(([, reject]) => {
        reject(err);
      });
      return;
    }

    waiting.forEach(([resolve, reject]) => {
      if (document) {
        resolve(document);
      } else {
        reject(err!);
      }
    });
  };

  private doTheLoad = async (req: GetDocument) => {
    const asString = this.asString(req);
    // sanity
    if (this.docs.has(asString)) {
      // todo: dequeue any waiting calls with response first
      throw new Error(
        `docs.doTheLoad called but ${asString} is already loaded`
      );
    }

    try {
      const doc = await this.client.docs.findOne(req);
      const activeDocRecord = observable({
        loading: false,
        error: null,
        saving: false,
        data: doc,
      });

      this.docs.set(asString, activeDocRecord);
      this.onLoadedOrErr(asString, doc);
    } catch (err) {
      this.onLoadedOrErr(asString, undefined, err);
    }
  };

  private findOrCreate = (req: GetDocument) => {
    const asString = this.asString(req);
    const doc = this.docs.get(asString);
    if (doc) {
      return doc;
    } else {
      const record: ActiveRecord<GetDocumentResponse> = observable({
        loading: false,
        error: null,
        saving: false,
        data: null,
      });

      this.docs.set(asString, record);
    }
  };

  private _loadDocument = async (
    req: GetDocument,
    record: DocRecord
  ): Promise<void> => {
    record.loading = true;
    record.error = null;
    try {
      const doc = await this.client.docs.findOne(req);
      record.data = doc;
      record.loading = false;
    } catch (err) {
      if (err instanceof ky.HTTPError) {
        if (err.response.status === 404 && req.isCreate) {
          record.data = { mdast: null, raw: "" };
        }
      } else {
        toaster.danger(`failed to load document ${err}`);
        record.error = err;
      }
      record.loading = false;
    }
  };

  loadDocument = (req: GetDocument): DocRecord => {
    const asString = this.asString(req);
    if (this.docs.has(asString)) {
      const docRecord = this.docs.get(asString)!;
      return docRecord;
    }

    const record: ActiveRecord<GetDocumentResponse> = observable({
      loading: true,
      error: null,
      saving: false,
      data: null,
    });

    // save it
    this.docs.set(asString, record);

    // load it, don't wait
    // todo: need to know if its for a new document...
    this._loadDocument(req, record);

    // return it
    return record;
  };

  saveDocument = async (req: SaveRequest) => {
    const doc = this.docs.get(this.asString(req));
    if (!doc) throw new Error("cannot save document, it is not in the cache");
    doc.saving = true;
    try {
      const updated = await this.client.docs.save(req);
      doc.data!.mdast = updated.mdast;
      doc.data!.raw = updated.raw;
    } catch (err) {
      doc.saving = false;
      doc.error = err;
      throw err;
    }

    doc.saving = false;
  };

  // untrack = (key: string) => () => {
  //   const count = this.tracking.get(key);
  //   if (count === undefined) {
  //     throw new Error(
  //       `[DocsStore.untrack] Expected to find one or more of ${key} in cache but found undefined`
  //     );
  //   } else {
  //     if (count === 1) {
  //       this.docs.delete(key);
  //       this.tracking.delete(key);
  //     } else {
  //       this.tracking.set(key, count - 1);
  //     }
  //   }
  // };
}
