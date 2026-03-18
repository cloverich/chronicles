export interface EditorAdapter<TState> {
  fromMarkdown(markdown: string): TState;
  toMarkdown(state: TState): string;
}

/**
 * Current baseline adapter shape for the existing Slate pipeline.
 * The lexical spike can implement the same interface to keep the rest of the
 * edit screen independent from editor internals.
 */
export interface EditorCapabilityMatrix {
  markdownRoundtrip: "native" | "adapter" | "missing";
  customNodes: "first-class" | "plugin" | "rewrite-needed";
  commandSystem: "transforms" | "commands";
  selectionModel: "path-based" | "key-based";
}

export const slatePlateCapabilities: EditorCapabilityMatrix = {
  markdownRoundtrip: "adapter",
  customNodes: "plugin",
  commandSystem: "transforms",
  selectionModel: "path-based",
};

export const lexicalCapabilities: EditorCapabilityMatrix = {
  markdownRoundtrip: "native",
  customNodes: "first-class",
  commandSystem: "commands",
  selectionModel: "key-based",
};
