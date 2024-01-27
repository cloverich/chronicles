import { cn, withCn, withVariants } from "@udecode/cn";
import {
  Caption as CaptionPrimitive,
  CaptionTextarea as CaptionTextareaPrimitive,
} from "@udecode/plate-caption";
import { cva } from "class-variance-authority";

const captionVariants = cva("max-w-full", {
  variants: {
    align: {
      left: "mr-auto",
      center: "mx-auto",
      right: "ml-auto",
    },
  },
  defaultVariants: {
    align: "center",
  },
});

export const Caption = withVariants(CaptionPrimitive, captionVariants, [
  "align",
]);

// For captioning images, media, and (technically) any other block
// https://platejs.org/docs/components/caption
export const CaptionTextarea = withCn(
  CaptionTextareaPrimitive,
  cn(
    "mt-2 w-full resize-none border-none bg-inherit p-0 font-[inherit] text-inherit",
    "focus:outline-none focus:[&::placeholder]:opacity-0",
    "text-center print:placeholder:text-transparent",
  ),
);
