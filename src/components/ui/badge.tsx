/**
 * Badge — a small pill for statuses, counts and tags.
 *
 * Variants match the `Tone` type from @/lib/constants (neutral | info | warning | success |
 * danger | brand) plus `outline`. Tinted tones use a ~12% wash of the base colour with the
 * darker, accessible text colour. For domain statuses prefer <StatusBadge kind status />.
 */
import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full px-2.5 py-0.75",
    "text-xs leading-4 font-medium whitespace-nowrap",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-secondary text-[#48484a]",
        info: "bg-info/12 text-info-foreground",
        warning: "bg-warning/12 text-warning-foreground",
        success: "bg-success/12 text-success-foreground",
        danger: "bg-danger/12 text-danger-foreground",
        brand: "bg-brand/12 text-brand-foreground",
        outline: "border border-border bg-transparent px-2 py-0.5 text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Render the child element (e.g. a <Link>) with badge styling. */
    asChild?: boolean;
  };

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "neutral"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeProps };
