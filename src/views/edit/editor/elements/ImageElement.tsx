import { cn } from "@udecode/cn";
import { PlateElement, PlateRenderElementProps } from "@udecode/plate-common";
import { ELEMENT_IMAGE, Image, useMediaState } from "@udecode/plate-media";
import React from "react";

import { MediaPopover } from "./MediaPopover";

// https://platejs.org/docs/components/image-element
export const ImageElement = ({
  className,
  children,
  nodeProps,
  ...props
}: PlateRenderElementProps) => {
  // NOTE: props.element contains url, alt, etc. This is never passed directly to
  // the ImageElement; I guess the downstream image pulls it from context?
  // Read plate-media source to see how it's used.
  // todo: Incorporate chronicles:// prefix here
  const { readOnly, focused, selected, align = "center" } = useMediaState();

  return (
    <MediaPopover pluginKey={ELEMENT_IMAGE}>
      <PlateElement
        className={cn("flex max-h-96 justify-start py-2.5", className)}
        {...props}
      >
        <Image
          className={cn(
            "max-h-full max-w-full cursor-pointer object-scale-down px-0",
            "rounded-sm",
            focused && selected && "ring-2 ring-ring ring-offset-2",
          )}
          alt=""
          {...nodeProps}
        />

        {children}
      </PlateElement>
    </MediaPopover>
  );
};
