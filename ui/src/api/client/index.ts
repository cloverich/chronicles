import { JournalsClient } from "./journals";
import { DocumentsClient } from "./documents";
import ky from "ky-universal";

export interface Client {
  journals: JournalsClient;
  documents: DocumentsClient;
}

export function configure(urlBase: string): Client {
  const myky = ky.extend({ prefixUrl: urlBase });
  return {
    journals: new JournalsClient(myky),
    documents: new DocumentsClient(myky),
  };
}
