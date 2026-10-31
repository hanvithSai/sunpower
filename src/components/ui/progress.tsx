/**
 * Progress — a slim horizontal bar for completion (checklists, payments, stock levels).
 * `value` is a percentage from 0 to 100 (clamped). Exposed to assistive tech as a progressbar;
 * pass `aria-label` (or `aria-labelledby`) to say what is progressing.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Percentage complete, 0–100. */
  value?: number | null;
  /** Override the fill colour, e.g. "bg-success". */
  indicatorClassName?: string;
};

function Progress({ className, value, indicatorClassName, ...props }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : 0));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full rounded-full bg-primary transition-[width] duration-200 ease-out", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
