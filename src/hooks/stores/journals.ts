import { observable, computed, toJS } from "mobx";
import { JournalResponse, IClient } from "../useClient";

export class JournalsStore {
  private isLoaded: boolean = false;
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable error: Error | null = null;
  @observable journals: JournalResponse[];

  @computed get active() {
    return this.journals.filter((j) => !j.archivedAt);
  }

  @computed get archived() {
    return this.journals.filter((j) => !!j.archivedAt);
  }

  constructor(
    private client: IClient,
    journals: JournalResponse[],
  ) {
    this.journals = journals;
  }

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

  toggleArchive = async (journal: JournalResponse) => {
    this.saving = true;

    // If I don't do this, the call to archive / unarchive will error with
    // "Object could not be cloned". It fails before executing the function,
    // so I guess its an error with Proxy objects being passed to preload
    // scripts. That is... concerning.
    journal = toJS(journal);

    try {
      if (journal.archivedAt) {
        this.journals = await this.client.journals.unarchive(journal);
      } else {
        this.journals = await this.client.journals.archive(journal);
      }
    } catch (err: any) {
      console.error(`Error toggling archive for journal ${journal.name}:`, err);
      this.saving = false;

      // NOTE: Otherwise this returns success, I'm unsure why the
      // other calls are storing the error?
      throw err;
    }

    this.saving = false;
  };
}

export type IJournalStore = JournalsStore;
