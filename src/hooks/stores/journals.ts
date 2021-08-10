import { IJournal, Client } from "../../client";
import { observable } from "mobx";
export class JournalsStore {
  private isLoaded: boolean = false;
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable error: Error | null = null;
  @observable journals: IJournal[];

  constructor(private client: Client) {
    this.journals = [];
  }

  load = async () => {
    if (this.isLoaded) return;

    try {
      this.journals = await this.client.journals.list();
    } catch (err) {
      this.error = err;
    }

    this.isLoaded = true;
    this.loading = false;
  };

  remove = async (journal: IJournal) => {
    this.saving = true;
    try {
      this.journals = await this.client.journals.remove(journal);
    } catch (err) {
      this.error = err;
    }
    this.saving = false;
  };

  add = async (journal: IJournal) => {
    this.saving = true;
    try {
      this.journals = await this.client.journals.add(journal);
    } catch (err) {
      this.error = err;
    }
    this.saving = false;
  };
}

export type IJournalStore = JournalsStore;
