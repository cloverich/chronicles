import { useLocalStore } from "mobx-react-lite";
import { useJournals } from "../hooks/useJournals";
import { useSearch } from "../hooks/useSearch";
import { useEventListener } from "../hooks/useEventListener";
import { JournalsUiStore } from "./store";

/**
 * Arguments passed to store to start editing
 * a document
 */
export interface EditingArgs {
  journal: string;
  date?: string;
}

/**
 * Event bubbled from heading elements to trigger
 * Focusing a heading.
 */
export interface FocusHeadingEvent {
  detail: {
    depth: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    content: string; // ex: ## todo heading
  };
}

export function useUiStore() {
  const journals = useJournals();
  const search = useSearch();
  const store = useLocalStore(() => new JournalsUiStore(journals, search));

  // Extract filter from event, and call setter
  const setFilterHandler = (ev: FocusHeadingEvent) => {
    store.focusHeading(ev.detail);
  };

  // Downstream, setting filter indicated by clicking on
  // a heading. This fires a custom event, since the component
  // is disconnected. Probably better to just put a setter into
  // the context and not use a custom event.
  useEventListener("focus-heading", setFilterHandler);

  return { store, journals, search };
}
