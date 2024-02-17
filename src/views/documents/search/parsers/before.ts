import { SearchToken, BeforeToken } from "../tokens";

export class BeforeTokenParser {
  prefix = "before:";
  serialize = (token: BeforeToken) => {
    return this.prefix + token.value;
  };

  parse = (text: string): BeforeToken | undefined => {
    if (!text) return;

    return { type: "before", value: text };
  };

  add = (tokens: SearchToken[], token: BeforeToken) => {
    // replace existing before token
    const existing = tokens.find((t) => t.type === "before");
    if (existing) {
      if (existing.value !== token.value) {
        const others = tokens.filter((t) => t !== existing);
        others.push(token);
      }
    } else {
      tokens.push(token);
      return tokens;
    }

    // returning a copy is consistent with other methods,
    // but feels useless
    const others = this.remove(tokens, token);
    if (others.length) {
      others.push(token);
      return others;
    } else {
      return [token];
    }
  };

  remove = (tokens: SearchToken[], token: BeforeToken) => {
    return tokens.filter((t) => {
      // since we can have only one before token; keep
      // everything that isn't an before token
      return t.type !== "before";
    });
  };
}
