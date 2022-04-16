import { SearchToken, TitleToken } from "../tokens";

export class TitleTokenParser {
    prefix = "title:";
    serialize = (token: TitleToken) => {
        return this.prefix + token.value;
    };

    parse = (text: string): TitleToken | undefined => {
        if (!text) return;

        return { type: "title", value: text };
    };

    add = (tokens: SearchToken[], token: TitleToken) => {
        if (tokens.find((t) => t.type === "title" && t.value === token.value)) {
            return tokens;
        }

        // returning a copy is consistent with other methods,
        // but feels useless
        const copy = tokens.slice();
        copy.push(token);
        return copy;
    };

    remove = (tokens: SearchToken[], token: TitleToken) => {
        return tokens.filter((t) => {
            // Keep all non-journal tokens
            if (t.type !== "title") return true;

            // Remove if it matches...
            return t.value !== token.value;
        });
    };
}
