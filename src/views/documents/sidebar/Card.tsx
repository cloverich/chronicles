import React from "react";

export const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="border-accent-muted bg-card text-foreground mb-4 rounded-sm border border-l-4 p-4 pl-3">
      {children}
    </div>
  );
};
