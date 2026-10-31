/**
 * Skeleton — a pulsing placeholder block shown while content loads.
 * Decorative (aria-hidden); wrap groups of skeletons in a role="status" region with
 * screen-reader text — the ready-made layouts in @/components/shared/skeletons do this.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      {...props}
    />
  );
}

export { Skeleton };
