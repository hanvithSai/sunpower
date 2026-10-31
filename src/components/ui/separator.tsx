/**
 * Separator — a hairline divider. Decorative by default (hidden from screen readers);
 * pass `decorative={false}` when it separates meaningful groups of content.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

type SeparatorProps = React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

function Separator({ className, orientation = "horizontal", decorative = true, ...props }: SeparatorProps) {
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full min-h-4 w-px self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
