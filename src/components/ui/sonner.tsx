"use client";

/**
 * Toaster — the app-wide toast host (sonner), styled as a white Apple-like notification
 * with a coloured status icon. Mounted once in the root layout; trigger toasts anywhere:
 *   import { toast } from "sonner";
 *   toast.success("Quote sent to Ravi Kumar");
 */
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-react";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      offset={{ top: 72, right: 24 }}
      mobileOffset={{ top: 64, left: 16, right: 16 }}
      gap={10}
      icons={{
        success: <CircleCheck className="size-4.5 text-success" />,
        info: <Info className="size-4.5 text-info" />,
        warning: <TriangleAlert className="size-4.5 text-warning" />,
        error: <OctagonX className="size-4.5 text-danger" />,
        loading: <LoaderCircle className="size-4.5 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        // sonner injects unlayered CSS, so these overrides need `!` (important) to win.
        classNames: {
          toast: "font-sans! shadow-lg!",
          title: "text-sm! font-medium! text-foreground!",
          description: "text-[13px]! text-muted-foreground!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
