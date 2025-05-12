import { PlateElement, PlateRenderElementProps } from "@udecode/plate-common";
import React from "react";
import { MediaWrapper } from "../features/images/MediaWrapper";
import { ELEMENT_VIDEO } from "../plugins/createVideoPlugin";
import { MediaPopover } from "./MediaPopover";

/**
 * Renders <video> elements. Expects a url to be present in the element.
 */
export const VideoElement = ({
  className,
  children,
  nodeProps,
  ...props
}: PlateRenderElementProps) => {
  return (
    <MediaPopover pluginKey={ELEMENT_VIDEO}>
      <PlateElement asChild className={className} {...props}>
        <>
          <MediaWrapper
            url={props.element.url as string}
            {...props}
            MediaComponent={({ url, className, onClick, onError, onLoad }) => (
              <video
                src={url}
                controls
                className="mx-auto block max-h-80 max-w-[80%] border border-black shadow-sm"
              >
                Unable to load video.
              </video>
            )}
          />
          {children}
        </>
      </PlateElement>
    </MediaPopover>
  );
};
