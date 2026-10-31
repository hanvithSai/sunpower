/**
 * Textarea — multi-line text field styled like <Input>.
 * Grows with its content in browsers that support `field-sizing: content`.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "placeholder:text-muted-foreground/70 selection:bg-primary/20",
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

export { Textarea };
