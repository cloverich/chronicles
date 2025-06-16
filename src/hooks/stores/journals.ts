import { computed, observable } from "mobx";
import { IClient, JournalResponse } from "../useClient";

export class JournalsStore {
  @observable loading: boolean = true;
  @observable saving: boolean = false;
  @observable error: Error | null = null;
  @observable journals: JournalResponse[];

  @computed get active() {
    return this.journals.filter((j) => !j.archived);
  }

  @computed get archived() {
    return this.journals.filter((j) => !!j.archived);
  }

  @observable defaultJournal: string;

  constructor(
    private client: IClient,
    journals: JournalResponse[],
    defaultJournal: string,
  ) {
    this.client = client;
    this.journals = journals;
    this.defaultJournal = defaultJournal;
  }

  // todo: Move to a proper start-up routine; fuse with sync routine
  static async init(client: IClient) {
    // todo: kind of silly post
    const jstore = new JournalsStore(client, [], "");
    await jstore.refresh();
    return jstore;
  }

  // todo: refactor so preferences and this store are always in sync
  private async assertNotDefault(journal: string) {
    const defaultJournal = await this.client.preferences.get("defaultJournal");

    if (journal === defaultJournal) {
      throw new Error(
        "Cannot archive / delete the default journal; set a different journal as default first.",
      );
    }
  }

  refresh = async () => {
    this.loading = true;
    try {
      this.journals = await this.client.journals.list();
      this.defaultJournal = await this.client.preferences.get("defaultJournal");
    } catch (err: any) {
      console.error("Error refreshing journals:", err);
      throw err;
    } finally {
      this.loading = false;
    }
  };

  remove = async (journal: JournalResponse) => {
    this.saving = true;
    try {
      await this.assertNotDefault(journal.name);

      await this.client.journals.remove(journal.name);
      await this.client.documents.deindexJournal(journal.name);
      this.journals = this.journals.filter((j) => j.name !== journal.name);
    } catch (err: any) {
      console.error("Error removing journal:", err);
      throw err;
    } finally {
      this.saving = false;
    }
  };

  // todo: client.journals has its own validation that is more robust than this
  // and isn ow exported us that
  validateName = (name: string) => {
    name = name.trim();
    if (!name) return ["Journal name cannot be empty", name];
    if (name.length > 25)
      return ["Journal name cannot be longer than 25 characters", name];

    if (this.journals.find((j) => j.name === name)) {
      return ["Journal with that name already exists", name];
    }

    return [null, name];
  };

  create = async (journal: string) => {
    this.saving = true;
    this.error = null;

    try {
      const [err, validName] = this.validateName(journal);
      if (err) throw new Error(err);

      const newJournal = await this.client.journals.create({
        name: validName!,
      });

      this.journals.push(newJournal);
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      this.saving = false;
    }
  };

  updateName = async (journal: JournalResponse, newName: string) => {
    this.saving = true;
    try {
      const [err, validName] = this.validateName(newName);
      if (err) throw new Error(err);

      const updatedAttrs = await this.client.journals.rename(
        // note: re-structured to avoid passing a Proxy object (sigh)
        { name: journal.name, archived: journal.archived },
        newName,
      );

      Object.assign(journal, updatedAttrs);
    } catch (err: any) {
      console.error(`Error updating journal name for ${journal.name}:`, err);
      throw err;
    } finally {
      this.saving = false;
    }
  };

  toggleArchive = async (journal: JournalResponse) => {
    this.saving = true;

    try {
      await this.assertNotDefault(journal.name);

      if (journal.archived) {
        this.journals = await this.client.journals.unarchive(journal.name);
      } else {
        this.journals = await this.client.journals.archive(journal.name);
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
  setDefault = async (journal: string) => {
    if (this.defaultJournal === journal) return;

    this.saving = true;
    try {
      await this.client.preferences.set("DEFAULT_JOURNAL", journal);
      this.defaultJournal = journal;
    } catch (err: any) {
      this.error = err;
      throw err;
    } finally {
      this.saving = false;
    }
  };
}

export type IJournalStore = JournalsStore;
