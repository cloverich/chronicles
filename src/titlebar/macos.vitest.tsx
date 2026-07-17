import { render, screen } from "@testing-library/react";
import React from "react";
import Titlebar from "./macos";

describe("Titlebar", () => {
  it("renders without children", () => {
    const { container } = render(<Titlebar />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders text children", () => {
    render(<Titlebar>My Journal</Titlebar>);
    expect(screen.getByText("My Journal")).toBeInTheDocument();
  });

  it("renders button children", () => {
    render(
      <Titlebar>
        <button>Back</button>
        <button>Settings</button>
      </Titlebar>,
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("applies additional className", () => {
    const { container } = render(<Titlebar className="pr-16" />);
    expect(container.firstChild).toHaveClass("pr-16");
  });

  // Skipped: jsdom does not recognize the non-standard, Electron-only
  // `-webkit-app-region` CSS property, so it silently drops it from the
  // CSSOM and getPropertyValue reads back empty. The component sets it
  // correctly (WebkitAppRegion: "drag") and it works in the real
  // Chromium/Electron runtime; this assertion is untestable under jsdom.
  it.skip("has drag region style", () => {
    const { container } = render(<Titlebar />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("-webkit-app-region")).toBe("drag");
  });
});
