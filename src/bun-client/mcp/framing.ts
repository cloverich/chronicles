export interface ContentLengthFrame {
  body: string;
}

/**
 * Parses "Content-Length" framed messages used by JSON-RPC over stdio.
 */
export class ContentLengthParser {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer | Uint8Array): ContentLengthFrame[] {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    const frames: ContentLengthFrame[] = [];

    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const headerRaw = this.buffer.subarray(0, headerEnd).toString("utf8");
      const length = this.parseContentLength(headerRaw);
      if (length === null) {
        throw new Error("Missing Content-Length header");
      }

      const messageEnd = headerEnd + 4 + length;
      if (this.buffer.length < messageEnd) break;

      const body = this.buffer
        .subarray(headerEnd + 4, messageEnd)
        .toString("utf8");
      frames.push({ body });
      this.buffer = this.buffer.subarray(messageEnd);
    }

    return frames;
  }

  private parseContentLength(headerRaw: string): number | null {
    const lines = headerRaw.split("\r\n");
    for (const line of lines) {
      const [name, value] = line.split(":", 2);
      if (!name || value === undefined) continue;
      if (name.trim().toLowerCase() !== "content-length") continue;
      const parsed = Number.parseInt(value.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Invalid Content-Length header");
      }
      return parsed;
    }
    return null;
  }
}

export function encodeContentLengthMessage(payload: unknown): string {
  const json = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
