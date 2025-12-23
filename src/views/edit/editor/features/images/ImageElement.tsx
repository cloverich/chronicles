import { cn } from "@udecode/cn";
import { useMediaState } from "@udecode/plate-media/react";
import { PlateElement, PlateElementProps } from "@udecode/plate/react";
import React from "react";

import { MediaPopover } from "../../elements/MediaPopover";
import { ELEMENT_IMAGE } from "../../plate-types";
import { ImageDisplay } from "./ImageDisplay";

// https://platejs.org/docs/components/image-element
export const ImageElement = ({
  className,
  children,
  ...props
}: PlateElementProps) => {
  const media = useMediaState();
  // useMediaState returns unsafeUrl but not url - we need to pass url to ImageDisplay
  const url = media.unsafeUrl || (props.element as any)?.url || "";

  return (
    <MediaPopover pluginKey={ELEMENT_IMAGE}>
      <PlateElement className={cn("flex justify-start", className)} {...props}>
        <ImageDisplay
          {...media}
          url={url}
          className="my-8 max-h-96 max-w-full cursor-pointer object-scale-down"
        />
        {children}
      </PlateElement>
    </MediaPopover>
  );
};
