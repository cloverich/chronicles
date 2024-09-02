import { PlateElement, PlateRenderElementProps } from "@udecode/plate-common";
import React from "react";
import { ELEMENT_VIDEO } from "../plugins/createVideoPlugin";
import { Caption, CaptionTextarea } from "./Caption";
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
        <figure className="group relative m-0" contentEditable={false}>
          <video
            src={props.element.url as any}
            controls
            style={{
              display: "block",
              maxWidth: "80%",
              maxHeight: "20em",
              margin: "auto", // center
            }}
          >
            Unable to load video.
          </video>
          <Caption align="center">
            <CaptionTextarea placeholder="Write a caption..." />
          </Caption>
          {children}
        </figure>
      </PlateElement>
    </MediaPopover>
  );
};
