/**
 * Label — a native <label> with design-system typography.
 * Native (not Radix) so it renders in Server Components and needs no JavaScript.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 text-[13px] font-medium leading-none text-foreground select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
