import { cn, withRef } from "@udecode/cn";
import { PlateElement, TElement } from "@udecode/plate-common";
import React from "react";

export const ELEMENT_IMAGE_GROUP = "imageGroupElement";

export interface IImageGroupElement extends TElement {
  images: string[];
}

/**
 * When multiple images appear consecutively in the document, they are grouped
 * into an imageGroupElement node type (see parser). This component displays them
 * as a gallery
 */
export const ImageGroupElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    // const element = useElement<IImageGroupElement>();

    return (
      <PlateElement ref={ref} asChild {...props}>
        <>
          <div
            className={cn(
              "grid gap-2",
              // Dynamic column counts depending on image counts
              {
                1: "grid-cols-1",
                2: "grid-cols-2",
                3: "grid-cols-3",
                4: "grid-cols-2",
                5: "grid-cols-3",
              }[React.Children.count(children)] || "grid-cols-3",
              "max-w-full",

              className,
            )}
          >
            {children}
          </div>
        </>
      </PlateElement>
    );
  },
);
