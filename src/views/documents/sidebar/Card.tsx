import React from "react";

export const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mb-4 rounded-sm border border-l-4 border-accent-muted bg-card p-4 pl-3 text-foreground">
      {children}
    </div>
  );
};
