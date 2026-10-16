# Shrink library

`yarn shrink-library` re-encodes the attachments notes already use to the
iPhone app's "Large" ingest policy, then removes attachments no note uses.
Code: `src/node-client/media-policy.ts` (policy), `src/node-client/shrink.ts`
(operation), `scripts/shrink-library.ts` (CLI). Plan and results: Engram note
`03h29lxosr0nhnv5g7r1glyk9`.

```bash
yarn shrink-library --app                    # dry run on the app's library
yarn shrink-library --app --apply --backup ~/Desktop/chronicles-before-shrink.zip
yarn shrink-library --notes-dir <dir> --db <chronicles.db>   # any library
```

Quit Chronicles first; `--apply` refuses while it runs and requires
`--backup` (a full `.zip` export plus a `VACUUM INTO` database copy) unless
`--no-backup` is given.

## Decisions

- **One policy, two implementations.** `media-policy.ts` mirrors
  chronicles-apple `ImageIngest.swift` and `VideoIngest.swift` (2048 px JPEG
  q0.8, PNG kept, GIF untouched; H.264 ≤1920 px ≤30 fps ~0.08 bits/pixel/frame,
  AAC 128k, HDR → Rec. 709). Change both together.
- **Deviations from the phone:** animated images are skipped (JPEG would drop
  the animation); a transcoded video that isn't smaller is discarded and the
  original kept; video metadata is dropped except `creation_time` (the phone
  writes none).
- **EXIF:** sharp can't drop one IFD, so `keptExif` reads Make, Model, the
  dates, offsets and lens from the original and writes only those back. GPS
  and everything else is gone.
- **Notes keep `updatedAt`.** Swapping a blob is a storage change, not an
  edit: content and revision change, list order doesn't. The swap is one
  transaction per file (`AttachmentStore.replaceAttachment`); the old blob is
  deleted only if no note still mentions its sha256 in any form.
- **"Referenced" means the sha256 appears in a note's content or front
  matter**, the same test the phone's Storage page uses. The sweep deletes
  every pool file and `attachments` row outside that set, plus leftover
  `.tmp-` files, so it must not run while the app is writing.
- **Encoder:** `h264_videotoolbox` when ffmpeg has it (fast, hardware),
  otherwise `libx264`; `--encoder` overrides.
- **Dry run sizes:** images are re-encoded in memory, so their numbers are
  exact; videos are estimated as planned bitrate × duration.
- HEIC needs a libheif with HEVC decoding, which sharp's prebuilt binaries
  lack; such files are reported and left as they are.
