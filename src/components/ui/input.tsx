/**
 * Input — single-line text field (shadcn/ui-compatible).
 * Uncontrolled-friendly so plain <form action={serverAction}> posts just work.
 * Set `aria-invalid` (FormField does this for you) to show the error style.
 * On touch devices the text is 16px so iOS Safari does not zoom on focus.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "placeholder:text-muted-foreground/70 selection:bg-primary/20",
        "file:mr-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger/40",
        "pointer-coarse:h-11 pointer-coarse:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
