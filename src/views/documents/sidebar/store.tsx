import { computed, observable } from "mobx";
import React from "react";
import { toast } from "sonner";
import { JournalsStore } from "../../../hooks/stores/journals";
import { JournalResponse } from "../../../hooks/useClient";
import { useJournals } from "../../../hooks/useJournals";
import { SearchStore } from "../SearchStore";

export function useSidebarStore(
  search: SearchStore,
  setIsShown: (isShown: boolean) => any,
) {
  const searchStore = search;
  const jstore = useJournals();

  const [sidebarStore, _] = React.useState(
    () => new SidebarStore(jstore, searchStore, setIsShown),
  );

  return sidebarStore;
}

/**
 * Sidebar store for managing the sidebar state.
 */
export class SidebarStore {
  @observable saving: boolean;
  @observable adding: boolean;
  @observable editing: string | undefined;

  @computed get shouldEscapeClose() {
    return !this.adding && !this.editing;
  }

  searchStore: SearchStore;
  journalStore: JournalsStore;
  setIsShown: any;

  constructor(
    journalStore: JournalsStore,
    searchStore: SearchStore,
    setIsShown: any,
  ) {
    this.saving = false;
    this.adding = false;
    this.editing = undefined;

    this.journalStore = journalStore;
    this.searchStore = searchStore;
    this.setIsShown = setIsShown;
  }

  onOpenChanged = (isOpen: boolean) => {
    if (!isOpen) {
      this.adding = false;
      this.editing = undefined;
    }

    this.setIsShown(isOpen);
  };

  search = (journal: string) => {
    this.searchStore.setSearch([`in:${journal}`]);

    // close when searching; probably just move this logic to parent
    this.setIsShown(false);

    // Because called from a link, prevent default... encapsulation = fail
    return false;
  };

  searchTag = (tag: string) => {
    this.searchStore.setSearch([`tag:${tag}`]);
    this.setIsShown(false);

    // Because called from a link, prevent default... encapsulation = fail
    return false;
  };

  toggleEditing = (journal?: string) => {
    this.adding = false;
    this.editing = journal; // undefined to close
  };

  toggleAdding = () => {
    this.editing = undefined;
    this.adding = !this.adding;
  };

  onArchive = async (journal: JournalResponse) => {
    if (this.saving) return;

    this.saving = true;

    try {
      await this.journalStore.toggleArchive(journal);
    } catch (err) {
      toast.error(`Error archiving journal ${String(err)}`);
    } finally {
      this.saving = false;
    }
  };

  onDelete = async (journal: JournalResponse) => {
    if (this.saving) return;
    this.saving = true;

    try {
      if (confirm(`Are you sure you want to delete ${journal.name}?`)) {
        await this.journalStore.remove(journal);
        this.searchStore.removeToken(`in:${journal.name}`);
      }
    } catch (err) {
      toast.error(`Error deleting journal ${String(err)}`);
    } finally {
      this.saving = false;
    }
  };

  onSetDefault = async (journal: JournalResponse) => {
    if (this.saving) return;
    this.saving = true;

    try {
      await this.journalStore.setDefault(journal.name);
    } catch (err) {
      toast.error(`Error setting journal as default ${String(err)}`);
    } finally {
      this.saving = false;
    }
  };
}
