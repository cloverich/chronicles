import { cn } from "@udecode/cn";
import React from "react";

import { MediaWrapper } from "./MediaWrapper";

interface Props {
  url: string;
  focused?: boolean;
  selected?: boolean;
  readOnly?: boolean;
  align?: string;
  className?: string;
  children?: React.ReactNode;
  displayOverlay?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const ImageDisplay = (props: Props) => {
  return (
    <MediaWrapper
      {...props}
      MediaComponent={({ url, className, onClick, onError, onLoad }) => (
        <img
          src={url}
          className={cn("border border-black shadow-sm", className)}
          onClick={(e) => onClick?.(e)}
          onError={onError}
          onLoad={onLoad}
          alt=""
        />
      )}
    />
  );
};
