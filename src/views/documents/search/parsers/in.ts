import { JournalToken, SearchToken } from "../tokens";

export class JournalTokenParser {
  prefix = "in:";
  serialize = (token: JournalToken) => {
    return this.prefix + token.value;
  };

  parse = (text: string): JournalToken | undefined => {
    if (!text) return;

    return { type: "in", value: text };
  };

  add = (tokens: SearchToken[], token: JournalToken) => {
    // there can be only one of each named journal
    if (tokens.find((t) => t.type === "in" && t.value === token.value)) {
      return tokens;
    }

    // returning a copy is consistent with other methods,
    // but feels useless
    const copy = tokens.slice();
    copy.push(token);
    return copy;
  };

  remove = (tokens: SearchToken[], token: JournalToken) => {
    // Find the token matching this one... and remove it...
    return tokens.filter((t) => {
      // Keep all non-journal tokens
      if (t.type !== "in") return true;

      // Remove if it matches...
      return t.value !== token.value;
    });
  };
}
