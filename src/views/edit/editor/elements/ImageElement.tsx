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
  return (
    <MediaPopover pluginKey={ELEMENT_IMAGE}>
      <PlateElement
        className={cn("flex max-h-96 justify-start py-2.5", className)}
        {...props}
      >
        <ImageElementInner />
        {children}
      </PlateElement>
    </MediaPopover>
  );
};

type ImageLoadStatus =
  | "invalid_prefix"
  | "remote_image"
  | "valid"
  | "loading"
  | "not_found";

const ImageElementInner = () => {
  const {
    readOnly,
    focused,
    selected,
    align = "center",
    url,
  } = useMediaState();

  const [validStatus, setValidStatus] = React.useState<ImageLoadStatus>(() => {
    if (!url) return "invalid_prefix";
    if (url?.startsWith("http")) return "remote_image";
    if (!url?.startsWith("chronicles://../_attachments"))
      return "invalid_prefix";

    return "loading";
  });

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setValidStatus("valid");
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // todo: Unsure how to distinguish a 404 from other errors; there will be an associated
    // global GET error, but unclear if / how its tied to _this_ error.
    e.preventDefault();
    e.stopPropagation();
    setValidStatus("not_found");
  };

  switch (validStatus) {
    case "remote_image":
      return (
        <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-200">
          <Alert variant="warning" title="Blocked image" className="mt-2">
            <p>
              Unable to load remote image. Remote images are not allowed by
              Chronicles. Download and copy the image into Chronicles instead.
            </p>
            <code className="mt-2 break-all">URL: {url}</code>
          </Alert>
        </div>
      );
    case "not_found":
      return (
        <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-200">
          <Alert variant="warning" title="Missing image" className="mt-2">
            <p>
              There was an error loading this image. It may have been deleted or
              moved?
            </p>
            <code className="mt-2 break-all">URL: {url}</code>
          </Alert>
        </div>
      );
    case "invalid_prefix":
      return (
        <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-200">
          <Alert variant="warning" title="Invalid prefix" className="mt-2">
            <p>
              Valid image urls must begin with: chronicles://../_attachments
            </p>
            <code className="mt-2 break-all">URL: {url}</code>
          </Alert>
        </div>
      );
    case "valid":
    case "loading": // todo: something fancier
      return (
        <img
          src={url}
          onLoad={onLoad}
          onError={handleError}
          className={cn(
            "max-h-full max-w-full cursor-pointer object-scale-down px-0",
            "rounded-sm",
            focused && selected && "ring-2 ring-ring ring-offset-2",
          )}
          alt=""
        />
      );
  }
};
