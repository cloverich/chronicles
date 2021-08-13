import { IJournal, Client } from "../../client";
import { JournalResponse } from "../../api/client/journals";
import { observable } from "mobx";

export class JournalsStoreV2 {
  private isLoaded: boolean = false;
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable error: Error | null = null;
  @observable journals: JournalResponse[];

  constructor(private client: Client) {
    this.journals = [];
  }

  load = async () => {
    if (this.isLoaded) return;

    try {
      this.journals = await this.client.v2.journals.list();
    } catch (err) {
      this.error = err;
    }

    this.isLoaded = true;
    this.loading = false;
  };

  remove = async (journalId: string) => {
    this.saving = true;
    try {
      // todo: update this.journals
      await this.client.v2.journals.remove({ id: journalId });
      this.journals = this.journals.filter((j) => j.id !== journalId);
    } catch (err) {
      this.error = err;
    }
    this.saving = false;
  };

  create = async ({ name }: { name: string }) => {
    this.saving = true;
    this.error = null;
    try {
      const newJournal = await this.client.v2.journals.create({
        name: name,
      });
      this.journals.push(newJournal);
    } catch (err) {
      this.error = err;
    }
    this.saving = false;
  };
}

export type IJournalStore = JournalsStoreV2;
