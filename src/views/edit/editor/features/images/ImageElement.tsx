import { cn } from "@udecode/cn";
import { PlateElement, PlateRenderElementProps } from "@udecode/plate-common";
import { ELEMENT_IMAGE, useMediaState } from "@udecode/plate-media";
import React from "react";

import { MediaPopover } from "../../elements/MediaPopover";
import { ImageDisplay } from "./ImageDisplay";

// https://platejs.org/docs/components/image-element
export const ImageElement = ({
  className,
  children,
  nodeProps,
  ...props
}: PlateRenderElementProps) => {
  const { ...media } = useMediaState();

  return (
    <MediaPopover pluginKey={ELEMENT_IMAGE}>
      <PlateElement className={cn("flex justify-start", className)} {...props}>
        <ImageDisplay
          {...media}
          className="my-8 max-h-96 max-w-full cursor-pointer object-scale-down"
        />
        {children}
      </PlateElement>
    </MediaPopover>
  );
};
