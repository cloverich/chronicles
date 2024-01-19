import { SearchToken, TextToken } from "../tokens";

export class TextTokenParser {
  prefix = "text:";
  serialize = (token: TextToken) => {
    return this.prefix + token.value;
  };

  parse = (text: string): TextToken | undefined => {
    if (!text) return;

    return { type: "text", value: text };
  };

  add = (tokens: SearchToken[], token: TextToken) => {
    if (tokens.find((t) => t.type === "text" && t.value === token.value)) {
      return tokens;
    }

    // returning a copy is consistent with other methods,
    // but feels useless
    const copy = tokens.slice();
    copy.push(token);
    return copy;
  };

  remove = (tokens: SearchToken[], token: TextToken) => {
    return tokens.filter((t) => {
      // Keep all non-journal tokens
      if (t.type !== "text") return true;

      // Remove if it matches...
      return t.value !== token.value;
    });
  };
}
