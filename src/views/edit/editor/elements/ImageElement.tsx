import { cn } from "@udecode/cn";
import { PlateElement, PlateRenderElementProps } from "@udecode/plate-common";
import { ELEMENT_IMAGE, useMediaState } from "@udecode/plate-media";
import React from "react";

import { Alert } from "../../../../components/Alert";
import { MediaPopover } from "./MediaPopover";

// https://platejs.org/docs/components/image-element
export const ImageElement = ({
  className,
  children,
  nodeProps,
  ...props
}: PlateRenderElementProps) => {
  const {
    readOnly,
    focused,
    selected,
    align = "center",
    url,
  } = useMediaState();

  // When image fails to load, show a placeholder
  // Otherwise, its not obvious an image is missing (blank space)
  const [showPlaceholder, setShowPlaceholder] = React.useState(false);

  // note: dictated by CSP policy; see index.html
  const [isRemoteImage] = React.useState(url?.startsWith("http"));

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // todo: Unsure how to distinguish a 404 from other errors; there will be an associated
    // global GET error, but unclear if / how its tied to _this_ error.
    e.preventDefault();
    e.stopPropagation();
    setShowPlaceholder(true);
  };

  return (
    <MediaPopover pluginKey={ELEMENT_IMAGE}>
      <PlateElement
        className={cn("flex max-h-96 justify-start py-2.5", className)}
        {...props}
      >
        {showPlaceholder ? (
          <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-200">
            {isRemoteImage ? (
              <Alert variant="warning" title="Blocked image" className="mt-2">
                <p>
                  Unable to load remote image. Remote images are not allowed by
                  Chronicles. Download and copy the image into Chronicles
                  instead.
                </p>
                <code className="mt-2 break-all">URL: {url}</code>
              </Alert>
            ) : (
              <Alert variant="warning" title="Missing image" className="mt-2">
                <p>
                  There was an error loading this image. It may have been
                  deleted or moved?
                </p>
                <code className="mt-2 break-all">URL: {url}</code>
              </Alert>
            )}
          </div>
        ) : (
          <img
            src={url}
            onError={handleError}
            className={cn(
              "max-h-full max-w-full cursor-pointer object-scale-down px-0",
              "rounded-sm",
              focused && selected && "ring-2 ring-ring ring-offset-2",
            )}
            alt=""
          />
        )}
        {children}
      </PlateElement>
    </MediaPopover>
  );
};
