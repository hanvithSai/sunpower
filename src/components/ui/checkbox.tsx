/**
 * Checkbox — a native <input type="checkbox"> with Apple-style rounded square and blue fill.
 * Posts "on" (or its `value`) with plain forms. Pair it with a <label> for a large hit area:
 *   <label className="flex items-center gap-2"><Checkbox name="earthing" /> Earthing done</label>
 * The tick/dash artwork lives in globals.css (input[data-slot="checkbox"]).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-4.5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-input bg-card shadow-xs",
        "transition-[background-color,border-color] duration-150 ease-out",
        "checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        "pointer-coarse:size-5",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
