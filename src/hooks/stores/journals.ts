import { computed, makeObservable, observable } from "mobx";
import type { Journal, NotesClient } from "../../contract/notes";
import { asciiLower, validateJournalName } from "../../contract/rules";
import type { Settings } from "../useSettings";

/** The default journal is a per-app setting, not library data. */
type JournalSettings = Pick<Settings, "get" | "setMany">;

export class JournalsStore {
  loading: boolean = true;
  saving: boolean = false;
  error: Error | null = null;
  journals: Journal[];

  get active() {
    return this.journals.filter((j) => !j.archived);
  }

  get archived() {
    return this.journals.filter((j) => !!j.archived);
  }

  defaultJournal: string;

  constructor(
    private notes: NotesClient,
    private settings: JournalSettings,
    journals: Journal[],
    defaultJournal: string,
  ) {
    this.journals = journals;
    this.defaultJournal = defaultJournal;

    makeObservable(this, {
      loading: observable,
      saving: observable,
      error: observable,
      journals: observable,
      active: computed,
      archived: computed,
      defaultJournal: observable,
    });
  }

  // todo: Move to a proper start-up routine; fuse with sync routine
  static async init(notes: NotesClient, settings: JournalSettings) {
    const jstore = new JournalsStore(notes, settings, [], "");
    await jstore.refresh();
    return jstore;
  }

  // todo: refactor so preferences and this store are always in sync
  private async assertNotDefault(journal: string) {
    const defaultJournal = await this.settings.get("defaultJournal");

    if (journal === defaultJournal) {
      throw new Error(
        "Cannot archive / delete the default journal; set a different journal as default first.",
      );
    }
  }

  refresh = async () => {
    this.loading = true;
    try {
      this.journals = (await this.notes.listJournals()).journals;
      this.defaultJournal = (await this.settings.get("defaultJournal")) ?? "";
    } catch (err: any) {
      console.error("Error refreshing journals:", err);
      throw err;
    } finally {
      this.loading = false;
    }
  };

  remove = async (journal: Journal) => {
    this.saving = true;
    try {
      await this.assertNotDefault(journal.name);

      await this.notes.deleteJournal({ id: journal.id });
      this.journals = this.journals.filter((j) => j.id !== journal.id);
    } catch (err: any) {
      console.error("Error removing journal:", err);
      throw err;
    } finally {
      this.saving = false;
    }
  };

  /** The contract's name rules, checked here for an immediate message. */
  validateName = (name: string, self?: Journal) => {
    try {
      name = validateJournalName(name);
    } catch (err) {
      return [(err as Error).message, name];
    }

    const taken = this.journals.find(
      (j) => asciiLower(j.name) === asciiLower(name) && j.id !== self?.id,
    );
    if (taken) return ["Journal with that name already exists", name];

    return [null, name];
  };

  create = async (journal: string) => {
    this.saving = true;
    this.error = null;

    try {
      const [err, validName] = this.validateName(journal);
      if (err) throw new Error(err);

      this.journals.push(await this.notes.createJournal({ name: validName! }));
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      this.saving = false;
    }
  };

  updateName = async (journal: Journal, newName: string) => {
    this.saving = true;
    try {
      const [err, validName] = this.validateName(newName, journal);
      if (err) throw new Error(err);

      Object.assign(
        journal,
        await this.notes.renameJournal({ id: journal.id, name: validName! }),
      );
    } catch (err: any) {
      console.error(`Error updating journal name for ${journal.name}:`, err);
      throw err;
    } finally {
      this.saving = false;
    }
  };

  toggleArchive = async (journal: Journal) => {
    this.saving = true;

    try {
      await this.assertNotDefault(journal.name);

      // Don't allow archiving last journal. Note since last journal should automatically
      // be default, should not happen.
      if (!journal.archived && this.active.length <= 1) {
        throw new Error("Cannot archive last journal");
      }

      await this.notes.setJournalArchived({
        id: journal.id,
        archived: !journal.archived,
      });
      this.journals = (await this.notes.listJournals()).journals;
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
      await this.settings.setMany({ defaultJournal: journal });
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
