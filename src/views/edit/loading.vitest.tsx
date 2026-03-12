import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { EditLoadingComponent } from "./loading";

describe("Edit loading shell", () => {
  it("renders the back button while loading", () => {
    render(
      <MemoryRouter>
        <EditLoadingComponent />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: /back to documents/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unhandled Error")).not.toBeInTheDocument();
  });

  it("renders error details when loading fails", () => {
    render(
      <MemoryRouter>
        <EditLoadingComponent
          error={new Error("boom")}
          journal="work"
          documentId="daily-note"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unhandled Error")).toBeInTheDocument();
    expect(
      screen.getByText(/there was an error that crashed the editor/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/work\/daily-note\.md/i)).toBeInTheDocument();
  });
});
