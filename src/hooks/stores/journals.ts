import { observable } from "mobx";
import { JournalResponse, IClient } from "../useClient";

export class JournalsStore {
  private isLoaded: boolean = false;
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable error: Error | null = null;
  @observable journals: JournalResponse[];

  constructor(
    private client: IClient,
    journals: JournalResponse[],
  ) {
    this.journals = journals;
  }

  // create instance of store...
  static async create(client: IClient) {
    const journals = await client.journals.list();
    return new JournalsStore(client, journals);
  }

  idForName = (name: string) => {
    const nameLower = name.toLowerCase();
    const match = this.journals.find((j) => j.name === nameLower);
    if (match) return match.id;
  };

  load = async () => {
    if (this.isLoaded) return;

    try {
      this.journals = await this.client.journals.list();
    } catch (err: any) {
      this.error = err;
    }

    this.isLoaded = true;
    this.loading = false;
  };

  remove = async (journalId: string) => {
    this.saving = true;
    try {
      // todo: update this.journals
      await this.client.journals.remove({ id: journalId });
      this.journals = this.journals.filter((j) => j.id !== journalId);
    } catch (err: any) {
      this.error = err;
    }
    this.saving = false;
  };

  create = async ({ name }: { name: string }) => {
    this.saving = true;
    this.error = null;
    try {
      const newJournal = await this.client.journals.create({
        name: name,
      });
      this.journals.push(newJournal);
    } catch (err: any) {
      console.error(err);
      this.error = err;
    }
    this.saving = false;
  };
}

export type IJournalStore = JournalsStore;
