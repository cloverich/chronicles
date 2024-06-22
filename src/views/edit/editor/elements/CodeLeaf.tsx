import React from "react";
import { PlateLeaf, PlateLeafProps } from "@udecode/plate-common";

export function CodeLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf asChild className={className} {...props}>
      <code>{children}</code>
    </PlateLeaf>
  );
}

// Plates version does this:
// But for now, I just want the absolute basics.
// export const CodeLeaf = withRef<typeof PlateLeaf>(
//   ({ children, className, ...props }, ref) => {
//     return (
//       <PlateLeaf
//         asChild
//         className={cn(
//           'whitespace-pre-wrap rounded-md bg-muted px-[0.3em] py-[0.2em] font-mono text-sm',
//           className
//         )}
//         ref={ref}
//         {...props}
//       >
//         <code>{children}</code>
//       </PlateLeaf>
//     );
//   }
// );
