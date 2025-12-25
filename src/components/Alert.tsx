import { cva, type VariantProps } from "class-variance-authority";
import { AngryIcon, InfoIcon, OctagonIcon, TriangleIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        warning: "border-warning/50 text-warning dark:border-warning",
        error: "border-error/50 text-error dark:border-error",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconForVariant = {
  default: InfoIcon,
  destructive: OctagonIcon,
  warning: TriangleIcon,
  error: AngryIcon,
};

interface IAlert {
  // variant: "default" | "destructive" | "warning" | "error";
  title: string;
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants> &
    IAlert
>(({ className, variant, title, children }, ref) => {
  const Icon = iconForVariant[variant || "default"];
  return (
    <AlertBase ref={ref} variant={variant} className={className}>
      <div className="flex overflow-auto">
        {/* This worked ok to display Icon but layout wasn't great */}
        {/* <div className="mr-2 h-6 w-6">
          <Icon
            strokeWidth={1}
            className="mr-2 h-6 w-6"
            size={32}
            fontSize={32}
            height={32}
            width={32}
          />
        </div> */}
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{children}</AlertDescription>
        </div>
      </div>
    </AlertBase>
  );
});

Alert.displayName = "Alert";

const AlertBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
AlertBase.displayName = "AlertBase";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mt-1 mb-1 text-lg leading-none font-medium tracking-tight",
      className,
    )}
    {...props}
  />
));

AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertBase, AlertDescription, AlertTitle };
