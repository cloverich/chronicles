import { PlateElement, type PlateElementProps } from "platejs/react";
import React from "react";
import { useFocused, useSelected } from "slate-react";

import { ELEMENT_VIDEO } from "../../../plate-types";
import { MediaPopover } from "./MediaPopover";
import { MediaWrapper } from "./MediaWrapper";

/**
 * Renders <video> elements for editorv2, with verbose error logging.
 */
export const VideoElement = ({
  className,
  children,
  ...props
}: PlateElementProps) => {
  const selected = useSelected();
  const focused = useFocused();
  const url = (props.element as any)?.url || "";

  const attachVideoDebug = React.useCallback((v: HTMLVideoElement | null) => {
    if (!v) return;

    const log = (name: string) => () => {
      const err = v.error;
      console.log(`[Video] ${name}`, {
        currentSrc: v.currentSrc,
        readyState: v.readyState,
        networkState: v.networkState,
        time: v.currentTime,
        err: err ? { code: err.code, message: (err as any).message } : null,
      });
    };

    const events = [
      "loadstart",
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "canplaythrough",
      "stalled",
      "suspend",
      "waiting",
      "progress",
      "seeking",
      "seeked",
      "durationchange",
      "timeupdate",
      "emptied",
      "abort",
      "error",
    ] as const;

    for (const ev of events) v.addEventListener(ev, log(ev));

    for (const s of Array.from(v.querySelectorAll("source"))) {
      s.addEventListener("error", () =>
        console.warn("[Video][source error]", s.src),
      );
    }

    return () => {
      for (const ev of events) v.removeEventListener(ev, log(ev));
    };
  }, []);

  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (ref.current) attachVideoDebug(ref.current);
  }, [attachVideoDebug, url, ref.current]);

  React.useEffect(() => {
    console.log("[VideoElement] Rendering video with url:", url);
  }, [url]);

  return (
    <MediaPopover pluginKey={ELEMENT_VIDEO}>
      <PlateElement className={className} {...props}>
        <MediaWrapper
          url={url}
          focused={focused}
          selected={selected}
          MediaComponent={({ url: resolvedUrl, className: mediaClassName }) => (
            <video
              ref={ref}
              src={resolvedUrl}
              controls
              className={mediaClassName}
              onError={(e) => {
                const v = e.currentTarget;
                const err = v.error;
                const mediaErrorCode =
                  err?.code === 1
                    ? "MEDIA_ERR_ABORTED"
                    : err?.code === 2
                      ? "MEDIA_ERR_NETWORK"
                      : err?.code === 3
                        ? "MEDIA_ERR_DECODE"
                        : err?.code === 4
                          ? "MEDIA_ERR_SRC_NOT_SUPPORTED"
                          : "UNKNOWN";

                console.error("[VideoElement] onError");
                console.error("  src:", v.currentSrc || v.src);
                console.error("  readyState:", v.readyState);
                console.error("  networkState:", v.networkState);
                console.error("  paused:", v.paused, "ended:", v.ended);
                console.error(
                  "  error:",
                  err
                    ? {
                        code: err.code,
                        mediaErrorCode,
                        message: (err as any).message,
                      }
                    : null,
                );
                console.error("  canPlayType mp4:", v.canPlayType("video/mp4"));
                console.error(
                  "  canPlayType webm:",
                  v.canPlayType("video/webm"),
                );

                try {
                  const buf = [];
                  for (let i = 0; i < v.buffered.length; i++) {
                    buf.push([v.buffered.start(i), v.buffered.end(i)]);
                  }
                  console.error("  buffered:", buf);
                } catch {}
              }}
              onLoadedData={(e) => {
                console.log("[VideoElement] Video loaded:", e);
              }}
            >
              Unable to load video.
            </video>
          )}
          className="mx-auto block max-h-80 max-w-[80%] border border-black shadow-xs"
        />
        {children}
      </PlateElement>
    </MediaPopover>
  );
};
