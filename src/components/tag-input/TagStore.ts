import { action, computed, makeObservable, observable, reaction } from "mobx";

interface Option {
  value: string;
  label?: string;
}

// Abstracted view model logic from TagInput; mix of this and the component
// logic can be improved
export class TagStore {
  query: string;
  delayedQuery: string;
  focusedIdx: number | null;
  options: Option[];
  tokens: string[];
  openOnEmptyFocus?: boolean;

  // todo: Needing this and isDropdownOpen smells; its primarily to support
  // force opening / closing the menu; but in general could be improved
  isOpen: boolean;
  get isDropdownOpen(): boolean {
    return (
      (this.isOpen && this.filteredOptions.length > 0) ||
      (this.isOpen && !!this.openOnEmptyFocus && this.query === "")
    );
  }

  constructor(
    options: Option[],
    openOnEmptyFocus?: boolean,
    tokens: string[] = [],
    delay: number = 200,
  ) {
    // Accept tokens in constructor
    this.query = "";
    this.delayedQuery = "";
    this.focusedIdx = null;
    this.isOpen = false;
    this.options = options;
    this.openOnEmptyFocus = openOnEmptyFocus;
    this.tokens = tokens; // Initialize tokens

    makeObservable(this, {
      query: observable,
      delayedQuery: observable,
      focusedIdx: observable,
      isOpen: observable,
      // set externally and replaced, not mutated
      options: observable.ref,
      tokens: observable.ref,
      filteredOptions: computed,
      focusedOption: computed,
      handleArrowUp: action,
      handleArrowDown: action,
    });

    // debounce
    reaction(
      () => this.query,
      (query) => (this.delayedQuery = query),
      { delay },
    );

    // Reset focused idx as query clears or dropdown closes
    reaction(
      () => ({
        query: this.delayedQuery,
        isOpen: this.isOpen,
        filteredOptionsLength: this.filteredOptions.length,
      }),
      ({ query, isOpen, filteredOptionsLength }) => {
        if (!isOpen || query === "") {
          this.focusedIdx = null;
        } else if (this.focusedIdx === null && filteredOptionsLength > 0) {
          this.focusedIdx = 0;
        } else if (
          this.focusedIdx !== null &&
          this.focusedIdx >= filteredOptionsLength
        ) {
          this.focusedIdx = 0;
        }
      },
    );
  }

  get filteredOptions(): Option[] {
    if (!this.options) return [];

    // Remove any options already selected
    let filtered = this.options.filter(
      (option) => !this.tokens.includes(option.value),
    );

    // Only filter if query is not empty, otherwise show all if openOnEmptyFocus is true
    if (!(this.delayedQuery === "" && this.openOnEmptyFocus)) {
      filtered = filtered.filter((o) =>
        o.value
          .toLocaleLowerCase()
          .includes(this.delayedQuery.toLocaleLowerCase()),
      );
    }

    return filtered;
  }

  get focusedOption(): Option | null {
    if (this.focusedIdx == null) return null;

    return this.filteredOptions[this.focusedIdx];
  }

  handleArrowUp = () => {
    if (this.focusedIdx != null && this.focusedIdx > 0) {
      this.focusedIdx = this.focusedIdx - 1;
    }
  };

  handleArrowDown = () => {
    if (this.focusedIdx === null) {
      this.focusedIdx = 0;
      return;
    }

    if (this.focusedIdx < this.filteredOptions.length - 1) {
      this.focusedIdx = this.focusedIdx + 1;
    }
  };
}
