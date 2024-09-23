import { SearchToken, TagToken } from "../tokens";

export class TagTokenParser {
  prefix = "tag:";

  serialize = (token: TagToken) => {
    return this.prefix + token.value;
  };

  parse = (text: string): TagToken | undefined => {
    if (!text) return;

    // trim # from the beginning of the tag
    if (text.startsWith("#")) {
      text = text.slice(1);
    }

    // remove spaces, snake_case -- arbitrary style decision
    text = text.replace(/ /g, "_");
    text = text.replace(/,/g, "_");
    text = text.toLowerCase();

    // remove `:` characters, since its reserved for search prefix e.g. `tag:my_tag`, `title: ...`, etc.
    text = text.replace(/:/g, "_");

    // max length, probably all search tokens need this? Or only this one since its persisted?
    // todo: A consistent strategy here.
    text = text.slice(0, 20);

    return { type: "tag", value: text };
  };

  add = (tokens: SearchToken[], token: TagToken) => {
    // there can be only one of each named journal
    if (tokens.find((t) => t.type === "tag" && t.value === token.value)) {
      return tokens;
    }

    // returning a copy is consistent with other methods,
    // but feels useless
    const copy = tokens.slice();
    copy.push(token);
    return copy;
  };

  remove = (tokens: SearchToken[], token: TagToken) => {
    // Find the token matching this one... and remove it...
    return tokens.filter((t) => {
      // Keep all non-journal tokens
      if (t.type !== "tag") return true;

      // Remove if it matches...
      return t.value !== token.value;
    });
  };
}
