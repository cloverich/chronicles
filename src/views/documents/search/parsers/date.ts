import { DateToken, SearchToken } from "../tokens";

export class DateTokenParser {
  prefix = "date:";
  serialize = (token: DateToken) => {
    return this.prefix + token.value;
  };

  parse = (text: string): DateToken | undefined => {
    if (!text) return;

    // Validate ISO8601 date formats: YYYY, YYYY-MM, or YYYY-MM-DD
    const yearPattern = /^\d{4}$/;
    const yearMonthPattern = /^\d{4}-\d{2}$/;
    const fullDatePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      yearPattern.test(text) ||
      yearMonthPattern.test(text) ||
      fullDatePattern.test(text)
    ) {
      return { type: "date", value: text };
    }

    // Invalid format - return undefined to drop the term
    // TODO: Show toast error "Use ISO8601 formatted dates"
    return undefined;
  };

  add = (tokens: SearchToken[], token: DateToken) => {
    // replace existing date token
    const existing = tokens.find((t) => t.type === "date");
    if (existing) {
      if (existing.value !== token.value) {
        const others = tokens.filter((t) => t !== existing);
        others.push(token);
        return others;
      }
      return tokens;
    } else {
      tokens.push(token);
      return tokens;
    }
  };

  remove = (tokens: SearchToken[], token: DateToken) => {
    return tokens.filter((t) => {
      // since we can have only one date token; keep
      // everything that isn't a date token
      return t.type !== "date";
    });
  };
}
