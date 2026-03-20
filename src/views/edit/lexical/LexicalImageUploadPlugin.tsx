import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $insertNodes,
  COMMAND_PRIORITY_HIGH,
  DROP_COMMAND,
  PASTE_COMMAND,
} from "lexical";
import React from "react";
import { toast } from "sonner";
import { isImageUrl } from "../../../hooks/images";
import { $createChroniclesImageNode } from "./ChroniclesImageNode";

type UploadImageWarningCode =
  | "decode_missing_plugin"
  | "decode_failed"
  | "process_failed";

type UploadImageResult = {
  url: string;
  warning?: {
    code: UploadImageWarningCode;
  };
};

function buildImageWarningMessage(
  filename: string,
  code: UploadImageWarningCode,
) {
  switch (code) {
    case "decode_missing_plugin":
      return `Image "${filename}" could not be processed (missing decoder). Saved original file; preview may fail.`;
    case "decode_failed":
      return `Image "${filename}" could not be processed. Saved original file; preview may fail.`;
    default:
      return `Image "${filename}" processing failed. Saved original file; preview may fail.`;
  }
}

function isFileLike(value: unknown): value is File {
  if (typeof File !== "undefined" && value instanceof File) {
    return true;
  }

  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).name === "string" &&
    typeof (value as File).type === "string" &&
    typeof (value as File).arrayBuffer === "function"
  );
}

function toFileArray(files: unknown): File[] {
  if (!files || typeof files !== "object") {
    return [];
  }

  if (Array.isArray(files)) {
    return files.filter(isFileLike);
  }

  const listLike = files as {
    length?: number;
    [index: number]: unknown;
  };
  if (typeof listLike.length !== "number") {
    return [];
  }

  return Array.from(
    { length: listLike.length },
    (_, index) => listLike[index],
  ).filter(isFileLike);
}

function getFilesFromDataTransfer(dataTransfer: unknown): File[] {
  if (!dataTransfer || typeof dataTransfer !== "object") {
    return [];
  }

  const maybeFiles = (dataTransfer as { files?: unknown }).files;
  const files = toFileArray(maybeFiles);
  if (files.length > 0) {
    return files;
  }

  const items = (dataTransfer as { items?: unknown }).items;
  if (!items || typeof items !== "object") {
    return [];
  }

  const itemList = toFileArray(items as unknown[]);
  if (itemList.length > 0) {
    return itemList;
  }

  const listLike = items as {
    length?: number;
    [index: number]: {
      kind?: string;
      getAsFile?: () => File | null;
    };
  };
  if (typeof listLike.length !== "number") {
    return [];
  }

  return Array.from({ length: listLike.length }, (_, index) => listLike[index])
    .map((item) =>
      item?.kind === "file" && typeof item.getAsFile === "function"
        ? item.getAsFile()
        : null,
    )
    .filter(isFileLike);
}

function extractImageFiles(event: unknown): File[] {
  if (!event || typeof event !== "object") {
    return [];
  }

  const dataTransfer = (event as { dataTransfer?: unknown }).dataTransfer;
  const clipboardData = (event as { clipboardData?: unknown }).clipboardData;

  return getFilesFromDataTransfer(dataTransfer ?? clipboardData).filter(
    (file) => file.type.startsWith("image/") || isImageUrl(file.name),
  );
}

function parseUploadResult(result: unknown): UploadImageResult | null {
  if (typeof result === "string") {
    return { url: result };
  }

  if (
    typeof result === "object" &&
    result !== null &&
    typeof (result as UploadImageResult).url === "string"
  ) {
    return result as UploadImageResult;
  }

  return null;
}

export function LexicalImageUploadPlugin(): null {
  const [editor] = useLexicalComposerContext();

  const uploadAndInsertImages = React.useCallback(
    async (files: File[]) => {
      const chronicles = (window as any).chronicles;
      const client = chronicles?.getClient?.();
      const uploadImageBytes = client?.files?.uploadImageBytes;
      if (typeof uploadImageBytes !== "function") {
        toast.warning("Image upload is not available.");
        return;
      }

      const results = await Promise.all(
        files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const uploadResult = parseUploadResult(
            await uploadImageBytes(buffer, file.name),
          );
          if (!uploadResult) {
            return null;
          }

          if (uploadResult.warning?.code) {
            toast.warning(
              buildImageWarningMessage(file.name, uploadResult.warning.code),
            );
          }

          return { altText: file.name, url: uploadResult.url };
        }),
      );

      const uploaded = results.filter(
        (r): r is { altText: string; url: string } => r !== null,
      );

      if (uploaded.length === 0) {
        return;
      }

      editor.update(() => {
        $insertNodes(
          uploaded.map((image) =>
            $createChroniclesImageNode(image.url, image.altText),
          ),
        );
      });
    },
    [editor],
  );

  React.useEffect(() => {
    function handleImageTransfer(event: Event): boolean {
      const files = extractImageFiles(event);
      if (files.length === 0) {
        return false;
      }

      event.preventDefault();
      void uploadAndInsertImages(files).catch((error) => {
        console.error("Failed to upload images", error);
        toast.error("Failed to upload image.");
      });
      return true;
    }

    const removeDrop = editor.registerCommand(
      DROP_COMMAND,
      handleImageTransfer,
      COMMAND_PRIORITY_HIGH,
    );
    const removePaste = editor.registerCommand(
      PASTE_COMMAND,
      handleImageTransfer,
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      removeDrop();
      removePaste();
    };
  }, [editor, uploadAndInsertImages]);

  return null;
}
