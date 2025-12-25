import React, { PropsWithChildren } from "react";

import { cn } from "../lib/utils";

interface Props extends PropsWithChildren {
  className?: string;
}

export default function Titlebar({ children, className }: Props) {
  return (
    <div
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className={cn(
        "border-accent-muted bg-secondary text-accent-foreground fixed z-10 flex h-(--titlebar-height) w-full items-center justify-between border-b px-2.5 py-3 pl-20 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
