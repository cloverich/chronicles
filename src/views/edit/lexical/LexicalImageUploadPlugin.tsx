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
        return;
      }

      const uploaded: Array<{ altText: string; url: string }> = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const uploadResult = parseUploadResult(
          await uploadImageBytes(buffer, file.name),
        );
        if (!uploadResult) {
          continue;
        }

        if (uploadResult.warning?.code) {
          toast.warning(
            buildImageWarningMessage(file.name, uploadResult.warning.code),
          );
        }

        uploaded.push({
          altText: file.name,
          url: uploadResult.url,
        });
      }

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
    return editor.registerCommand(
      DROP_COMMAND,
      (event) => {
        const files = extractImageFiles(event);
        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        void uploadAndInsertImages(files).catch((error) => {
          console.error("Failed to upload dropped images", error);
          toast.error("Failed to upload dropped image.");
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, uploadAndInsertImages]);

  React.useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const files = extractImageFiles(event);
        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        void uploadAndInsertImages(files).catch((error) => {
          console.error("Failed to upload pasted images", error);
          toast.error("Failed to upload pasted image.");
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, uploadAndInsertImages]);

  return null;
}
