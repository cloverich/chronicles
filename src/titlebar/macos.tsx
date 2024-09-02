import { cn } from "@udecode/cn";
import React, { PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  className?: string;
}

export default function Titlebar({ children, className }: Props) {
  return (
    <div
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className={cn(
        "fixed z-10 flex h-12 w-full items-center justify-between border-b border-accent bg-secondary px-2.5 py-3 pl-20 text-accent-foreground shadow",
        className,
      )}
    >
      {children}
    </div>
  );
}
