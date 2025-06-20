import React from "react";

import { Icons } from "./icons";

type CollapseProps = React.PropsWithChildren<{
  defaultOpen?: boolean;
  heading: string;
}>;

/**
 * Collapse component that can be toggled open and closed.
 */
export function Collapse({ heading, defaultOpen, children }: CollapseProps) {
  const [isOpen, setIsOpen] = React.useState(
    defaultOpen == null ? false : defaultOpen,
  );

  const Icon = isOpen ? Icons.chevronDown : Icons.chevronRight;

  return (
    <div>
      <div
        className="mb-2 flex cursor-pointer items-center font-system-heading tracking-tight"
        onClick={() => setIsOpen(!isOpen)}
      >
        {heading}
        <Icon size={18} />
      </div>
      {isOpen && children}
    </div>
  );
}
