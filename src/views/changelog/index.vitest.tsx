import { fireEvent, render, screen } from "@testing-library/react";
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
      screen.getByRole("heading", { name: "Unreleased" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "0.12.1 — 2026-03-02" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/0.13.0-dev · a1b2c3d · built 2026-09-18/),
    ).toBeInTheDocument();

    const firstEntry = screen.getAllByRole("listitem")[0];
    expect(firstEntry).toHaveTextContent(
      /^\d{4}-\d{2}-\d{2} [0-9a-f]{7} .+\.$/,
    );
  });

  it("shows raw commits only when selected", () => {
    render(
      <MemoryRouter>
        <Changelog />
      </MemoryRouter>,
    );
    expect(
      screen.queryByText("2026-09-18 a1b2c3d Example raw commit"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Raw commits" }));
    expect(
      screen.getByText("2026-09-18 a1b2c3d Example raw commit"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Unreleased" }),
    ).not.toBeInTheDocument();
  });
});
