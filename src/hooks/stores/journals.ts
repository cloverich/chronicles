import { observable, computed, toJS } from "mobx";
import { JournalResponse, IClient } from "../useClient";

export class JournalsStore {
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

  @observable defaultJournalId: string;

  constructor(
    private client: IClient,
    journals: JournalResponse[],
    defaultJournalId: string,
  ) {
    this.client = client;
    this.journals = journals;
    this.defaultJournalId = defaultJournalId;
  }

  static async create(client: IClient) {
    const journals = await client.journals.list();

    // todo: This is more like application setup state; should probably have a
    // global setup routine to track all this in one place.
    // ensure at least one journal exists
    if (journals.length === 0) {
      journals.push(await client.journals.create({ name: "My Journal" }));
    }

    // ensure a default journal is set
    let { DEFAULT_JOURNAL_ID: default_journal } =
      await client.preferences.get();

    if (!default_journal) {
      await client.preferences.setDefaultJournal(journals[0].id);
      default_journal = journals[0].id;
    }

    return new JournalsStore(client, journals, default_journal);
  }

  idForName = (name: string) => {
    const nameLower = name.toLowerCase();
    const match = this.journals.find((j) => j.name === nameLower);
    if (match) return match.id;
  };

  private async assertNotDefault(journalId: string) {
    const { DEFAULT_JOURNAL_ID: default_journal } =
      await this.client.preferences.get();

    if (journalId === default_journal) {
      throw new Error(
        "Cannot archive / delete the default journal; set a different journal as default first.",
      );
    }
  }

  remove = async (journalId: string) => {
    this.saving = true;
    try {
      await this.assertNotDefault(journalId);
      await this.client.journals.remove({ id: journalId });
      this.journals = this.journals.filter((j) => j.id !== journalId);
    } catch (err: any) {
      console.error("Error removing journal:", err);
      throw err;
    } finally {
      this.saving = false;
    }
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
      throw err;
    } finally {
      this.saving = false;
    }
  };

  toggleArchive = async (journal: JournalResponse) => {
    this.saving = true;

    // If I don't do this, the call to archive / unarchive will error with
    // "Object could not be cloned". It fails before executing the function,
    // so I guess its an error with Proxy objects being passed to preload
    // scripts. That is... concerning.
    journal = toJS(journal);

    try {
      await this.assertNotDefault(journal.id);

      if (journal.archivedAt) {
        this.journals = await this.client.journals.unarchive(journal);
      } else {
        this.journals = await this.client.journals.archive(journal);
      }
    } catch (err: any) {
      console.error(`Error toggling archive for journal ${journal.name}:`, err);

      // NOTE: Otherwise this returns success, I'm unsure why the
      // other calls are storing the error?
      throw err;
    } finally {
      this.saving = false;
    }
  };

  /**
   * Set the default journal; this is the journal that will be selected by
   * default when creating a new document, if no journal is selected.
   */
  setDefault = async (journalId: string) => {
    this.saving = true;
    try {
      await this.client.preferences.setDefaultJournal(journalId);
      this.defaultJournalId = journalId;
    } catch (err: any) {
      this.error = err;
      throw err;
    } finally {
      this.saving = false;
    }
  };
}

export type IJournalStore = JournalsStore;
