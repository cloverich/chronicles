import { cn } from "@udecode/cn";
import React from "react";
import { Alert } from "../../../../../components/Alert";

type MediaLoadStatus =
  | "invalid_prefix"
  | "remote_image"
  | "valid"
  | "loading"
  | "not_found";

interface MediaProps {
  url: string;
  focused?: boolean;
  selected?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

type MediaComponentProps = MediaProps & {
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
};

type MediaWrapperProps = MediaProps & {
  /**
   * The img or video component or lightweight wrapper (styling, etc) that MediaWrapper should
   * render when valid url is provided.
   */
  MediaComponent: React.FC<MediaComponentProps>;
  displayOverlay?: boolean;
};

/**
 * Just a wrapper for img and video elements to handle loading and error states in a consistent way.
 */
export const MediaWrapper = ({
  url,
  focused,
  selected,
  className,
  onClick,
  MediaComponent,
}: MediaWrapperProps) => {
  const [validStatus, setValidStatus] = React.useState<MediaLoadStatus>(() => {
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
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-slate-200",
            className,
          )}
        >
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
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-slate-200",
            className,
          )}
        >
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
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-slate-200",
            className,
          )}
        >
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
        <MediaComponent
          url={url}
          focused={focused}
          selected={selected}
          className={cn("mx-auto block max-h-80 max-w-[80%]", className)}
          onClick={(e) => onClick?.(e)}
          onError={handleError}
          onLoad={onLoad}
        />
      );
  }
};
