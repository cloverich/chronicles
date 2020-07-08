// todo: inject client into Store
import client, { GetDocument, GetDocumentResponse, SaveRequest } from ".";

// I feel like a WeakMap was designed to do this?
// Just store the object as the key in a WeakMap
// When all references to it are gone it gets garbage collected
// Then requests can check if it exists and return it if so?
export class DocsStore {
  private docs = new Map<string, GetDocumentResponse>();
  private tracking = new Map<string, number>();

  private asString(req: GetDocument) {
    return `${req.journalName}-${req.date}`;
  }

  // if isCreate... return nothing? idk...
  async loadDocument(req: GetDocument): Promise<GetDocumentResponse> {
    const asString = this.asString(req);
    const count = this.tracking.get(asString);
    if (count === undefined) {
      const doc = await client.docs.findOne(req);
      this.docs.set(asString, doc);
      this.tracking.set(asString, 1);
      return doc;
    } else {
      this.tracking.set(asString, count + 1);
      const doc = this.docs.get(asString);
      if (!doc)
        throw new Error(
          `[DocsStore.loadDocument] Expected to find ${asString} in cache but found ${doc}`
        );
      return doc;
    }
  }

  saveDocument = async (req: SaveRequest) => {
    // conttent?
    const doc = await client.docs.save(req);
    const cacheKey = this.asString(req);
    // update cache, if anyone is used
    if (this.docs.has(cacheKey)) {
      this.docs.set(cacheKey, doc);
    }
  };

  untrack = (key: string) => () => {
    const count = this.tracking.get(key);
    if (count === undefined) {
      throw new Error(
        `[DocsStore.untrack] Expected to find one or more of ${key} in cache but found undefined`
      );
    } else {
      if (count === 1) {
        this.docs.delete(key);
        this.tracking.delete(key);
      } else {
        this.tracking.set(key, count - 1);
      }
    }
  };
}
