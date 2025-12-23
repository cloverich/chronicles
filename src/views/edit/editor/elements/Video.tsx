import { useMediaState } from "@udecode/plate-media/react";
import { PlateElement, PlateElementProps } from "@udecode/plate/react";
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
  ...props
}: PlateElementProps) => {
  // Use the same pattern as ImageElement for URL resolution
  const media = useMediaState();
  const url = media.unsafeUrl || (props.element as any)?.url || "";

  const attachVideoDebug = React.useCallback((v: HTMLVideoElement | null) => {
    console.log("[VideoElement] attachVideoDebug", v);
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

    // Also surface <source> failures if you use <source>
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

  // Debug: log the video URL
  React.useEffect(() => {
    console.log(
      "[VideoElement] Rendering video with url:",
      url,
      "unsafeUrl:",
      media.unsafeUrl,
    );
  }, [url, media.unsafeUrl]);

  return (
    <MediaPopover pluginKey={ELEMENT_VIDEO}>
      <PlateElement className={className} {...props}>
        <MediaWrapper
          url={url}
          {...props}
          MediaComponent={({
            url: resolvedUrl,
            className,
            onClick,
            onError,
            onLoad,
          }) => (
            <video
              src={resolvedUrl}
              controls
              className="mx-auto block max-h-80 max-w-[80%] border border-black shadow-sm"
              onError={(e) => {
                const v = e.currentTarget;

                // HTMLMediaElement/HTMLVideoElement error info
                const err = v.error; // MediaError | null

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
                console.error("  readyState:", v.readyState); // 0-4
                console.error("  networkState:", v.networkState); // 0-3
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

                // Try to surface more context
                console.error("  canPlayType mp4:", v.canPlayType("video/mp4"));
                console.error(
                  "  canPlayType webm:",
                  v.canPlayType("video/webm"),
                );

                // Optional: dump buffered ranges
                try {
                  const buf = [];
                  for (let i = 0; i < v.buffered.length; i++)
                    buf.push([v.buffered.start(i), v.buffered.end(i)]);
                  console.error("  buffered:", buf);
                } catch {}

                onError?.(e as any);
              }}
              onLoadedData={(e) => {
                console.log("[VideoElement] Video loaded:", e);
                onLoad?.(e as any);
              }}
            >
              Unable to load video.
            </video>
          )}
        />
        {children}
      </PlateElement>
    </MediaPopover>
  );
};
