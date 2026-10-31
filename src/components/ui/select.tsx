/**
 * Select — a NATIVE <select> styled like <Input>.
 *
 * Native on purpose: it posts with plain HTML forms / Server Actions, works before
 * hydration, and gives the best picker on phones. Children are <option> elements:
 *   <Select id="discom" name="discom" defaultValue="TSSPDCL">
 *     <option value="TSSPDCL">TSSPDCL</option>
 *   </Select>
 * The Apple-style chevron is drawn in globals.css (select[data-slot="select"]).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Select({ className, multiple, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      multiple={multiple}
      className={cn(
        "flex w-full min-w-0 appearance-none rounded-lg border border-input bg-card text-sm text-foreground shadow-xs",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        multiple ? "min-h-24 px-2 py-1.5" : "h-9 truncate pr-9 pl-3 pointer-coarse:h-11",
        "focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger/40",
        "pointer-coarse:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
