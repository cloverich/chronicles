import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { useNotes } from "./hooks/useNotes";
import { startApp } from "./startup";

function Probe() {
  const notes = useNotes();
  return <div>app ready: {typeof notes.getNote}</div>;
}

function makeHost() {
  let finish!: () => void;
  let ready = false;
  const host = {
    ...window.chronicles,
    ready: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    // Like the preload: asking before ready throws.
    getClient: vi.fn(() => {
      if (!ready) throw new Error("getClient() called before initClient()");
      return {} as any;
    }),
    getNotesClient: vi.fn(() => {
      if (!ready) throw new Error("not ready");
      return { getNote: async () => ({}) } as any;
    }),
  };
  return {
    host,
    finish: () => {
      ready = true;
      finish();
    },
  };
}

describe("startApp", () => {
  it("waits for the host to open the library before asking for clients", async () => {
    const { host, finish } = makeHost();
    const { rerender } = render(<div />);
    const started = startApp(host as any, (c) => rerender(<>{c}</>), <Probe />);

    expect(screen.getByText("Opening your library…")).toBeInTheDocument();
    expect(host.getClient).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await started;
    });
    expect(screen.getByText("app ready: function")).toBeInTheDocument();
  });

  it("shows why startup failed", async () => {
    const host = {
      ...window.chronicles,
      ready: vi.fn(async () => {
        throw new Error("migration 0004 failed");
      }),
    };
    const { rerender } = render(<div />);
    await act(() =>
      startApp(host as any, (c) => rerender(<>{c}</>), <Probe />),
    );
    expect(screen.getByText(/could not open your library/)).toBeInTheDocument();
    expect(screen.getByText(/migration 0004 failed/)).toBeInTheDocument();
  });
});
