import { PlateElement, type PlateElementProps } from "platejs/react";
import React from "react";
import { useFocused, useSelected } from "slate-react";

import { cn } from "../../../../../lib/utils";
import { ELEMENT_IMAGE } from "../../../plate-types";
import { ImageDisplay } from "./ImageDisplay";
import { MediaPopover } from "./MediaPopover";

// https://platejs.org/docs/components/image-element
export const ImageElement = ({
  className,
  children,
  ...props
}: PlateElementProps) => {
  const selected = useSelected();
  const focused = useFocused();
  const url = (props.element as any)?.url || "";

  return (
    <MediaPopover pluginKey={ELEMENT_IMAGE}>
      <PlateElement className={cn("flex justify-start", className)} {...props}>
        <ImageDisplay
          url={url}
          focused={focused}
          selected={selected}
          className="my-8 max-h-96 max-w-full cursor-pointer object-scale-down"
        />
        {children}
      </PlateElement>
    </MediaPopover>
  );
};
