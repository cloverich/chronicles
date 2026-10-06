import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
import { vi } from "vitest";
import { createMemoryNotesClient } from "../../contract/memory";
import { ApplicationContext } from "../../hooks/useApplicationStore";
import { NotesContext } from "../../hooks/useNotes";
import FrontMatter from "./FrontMatter";

function makeDoc(overrides: Partial<Record<string, any>> = {}) {
  return observable({
    createdAt: "2026-03-25T00:00:00.000Z",
    title: "Test note",
    journalId: "j1",
    tags: [] as string[],
    save: vi.fn(),
    ...overrides,
  });
}

const fakeAppStore = {
  preferences: {
    fontSizes: {},
    fonts: {},
  },
} as any;

const journals = [{ id: "j1", name: "work", archived: false }] as any[];

function renderFrontMatter(doc = makeDoc()) {
  return {
    doc,
    ...render(
      <NotesContext.Provider value={createMemoryNotesClient()}>
        <ApplicationContext.Provider value={fakeAppStore}>
          <FrontMatter document={doc} journals={journals} />
        </ApplicationContext.Provider>
      </NotesContext.Provider>,
    ),
  };
}

describe("FrontMatter date picker", () => {
  it("shows the calendar when the date trigger is clicked", async () => {
    renderFrontMatter();

    fireEvent.click(screen.getByText("2026-03-25"));

    await waitFor(() => {
      expect(screen.getByRole("grid")).toBeInTheDocument();
    });
  });

  it("updates document.createdAt when a day is selected", async () => {
    const { doc } = renderFrontMatter();

    fireEvent.click(screen.getByText("2026-03-25"));

    await waitFor(() => screen.getByRole("grid"));

    // Click the day button for the 10th in the March 2026 calendar
    const dayButtons = screen.getAllByRole("button");
    const day10 = dayButtons.find((b) => b.textContent === "10");
    expect(day10).toBeTruthy();
    fireEvent.click(day10!);

    await waitFor(() => {
      expect(doc.createdAt).toContain("2026-03-10");
    });
  });
});
