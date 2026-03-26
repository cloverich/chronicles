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

  it("has drag region style", () => {
    const { container } = render(<Titlebar />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("-webkit-app-region")).toBe("drag");
  });
});
