import { IJournal } from "../journals";
export { IJournal } from "../journals";

import ky from "ky-universal";
type Ky = typeof ky;

export interface JournalResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export class JournalsClient {
  constructor(private ky: Ky) {}

  list = (): Promise<JournalResponse[]> => {
    return this.ky("v2/journals").json();
  };

  create = (journal: { name: string }): Promise<JournalResponse> => {
    return this.ky("v2/journals", {
      method: "post",
      json: journal,
    }).json();
  };

  remove = (journal: { id: string }): Promise<JournalResponse[]> => {
    return this.ky("v2/journals/" + journal.id, {
      method: "delete",
    }).json();
  };
}
