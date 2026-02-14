import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-muted text-foreground",
        success: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
        warning: "border-amber-400/40 bg-amber-500/15 text-amber-200",
        danger: "border-rose-400/40 bg-rose-500/15 text-rose-200",
        info: "border-sky-400/40 bg-sky-500/15 text-sky-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
