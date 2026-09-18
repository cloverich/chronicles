import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import Changelog from ".";

describe("Changelog surface", () => {
  it("renders grouped date-first entries and the build fingerprint", () => {
    render(
      <MemoryRouter>
        <Changelog />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Unreleased in this build" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "0.12.1 — 2026-03-02" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/0.13.0-dev · a1b2c3d · built 2026-09-18/),
    ).toBeInTheDocument();

    const firstEntry = screen.getAllByRole("listitem")[0];
    expect(firstEntry).toHaveTextContent(
      "2026-09-16 6020222 Made journal names unique regardless of capitalization.",
    );
  });
});
