import React, { PropsWithChildren } from "react";
import { cn } from "@udecode/cn";

interface Props extends PropsWithChildren {
  className?: string;
}

export default function Titlebar({ children, className }: Props) {
  return (
    <div
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className={cn(
        "bg-secondary border-b border-accent text-accent-foreground border-accent flex justify-between items-center py-3 px-2.5 pl-20 fixed w-full h-12 z-10 shadow",
        className,
      )}
    >
      {children}
    </div>
  );
}
