import { withCn } from "@udecode/cn";
import { PlateElement } from "@udecode/plate-common";

export const ParagraphElement = withCn(
  PlateElement,
  "mb-4 mt-px px-0 max-w-prose min-w-prose [font-size:var(--font-size-note-body)]",
);
