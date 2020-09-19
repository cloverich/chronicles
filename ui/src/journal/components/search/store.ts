import { observable, computed, action } from "mobx";
import { IJournalsUiStore } from "../../store";

/**
 * View model for displaying, adding, and removing search tokens
 */
export class TagSearchStore {
  constructor(private store: IJournalsUiStore) {}
  // This logic probably goes in a local store, in tag search
  // ...esp. because it needs to differentiate tokens from initial
  // tokens yeah... ?
  @computed get searchTokens() {
    return [
      ...this.store.selectedJournals.map((j) => `in:${j}`),
      this.store.focusedHeading
        ? `focus:${extractText(this.store.focusedHeading.content)}`
        : undefined,
    ].filter((value) => value) as string[];
  }

  @action
  addToken = (token: string) => {
    if (token.startsWith("focus:")) {
      const text = token.split("focus:")[1];
      if (!text.length) {
        console.warn("Ignoring ", token, "because no content found");
        return;
      } else {
        this.store.focusHeading(extractHeading(text));
      }
    }

    // detect duplicates
    // error if token already found...
    // validate its a journal
    if (token.startsWith("in:")) {
      const journal = token.split("in:")[1];
      const query = this.store.searchStore.query;
      if (query.journals.includes(journal)) {
        // Journal already in search, do nothing (or warn)
        console.info(
          "skipping search because journal already in search",
          journal
        );
      } else {
        // Add journal to search, if its a known journal
        if (this.store.journals.find((j) => j.name === journal)) {
          this.store.searchStore.query = {
            ...query,
            journals: [...query.journals, journal],
          };
        }
      }
    }
  };

  @action
  removeToken = (token: string) => {
    // validate its a journal
    if (token.startsWith("focus:")) {
      this.store.focusHeading();
    }
    if (token.startsWith("in:")) {
      const journal = token.split("in:")[1];

      // If the search was for 'in:'
      if (!journal.length) return;

      const query = this.store.searchStore.query;
      if (query.journals.includes(journal)) {
        this.store.searchStore.query = {
          ...query,
          journals: query.journals.filter((j) => j !== journal),
        };
      }
    }
  };
}

/**
 * # foo -- Yes
 * ## foo -- Yes
 * #foo -- No
 * foo #bar # baz -- No
 */
const hRegex = /^(#+) (.*)/;

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function tagForDepth(text: string): HeadingTag {
  if (!text.length || text.length > 6) {
    console.warn(
      "tagForDepth expected between 1-6 hashes, but got ",
      text.length,
      text,
      "returning `h1` as a default"
    );
    return "h1";
  }

  return `h${text.length}` as HeadingTag;
}

/**
 * Get the text part of a heading search
 * @param text -- search token for heading...
 */
function extractText(text: string): string {
  const matches = text.match(hRegex);
  if (!matches) return text;
  return matches[2];
}

function extractHeading(text: string) {
  // ['##', 'search text']
  const matches = text.match(hRegex);

  if (!matches) {
    // Infer h1, preprend '# ' to search
    return {
      type: "heading",
      content: "# " + text,
      depth: "h1" as HeadingTag,
    };
  } else {
    return {
      type: "heading",
      content: text, //matches[2],
      depth: tagForDepth(matches[1]),
    };
  }
}
