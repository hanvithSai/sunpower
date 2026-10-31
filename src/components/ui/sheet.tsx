"use client";

/**
 * Sheet — a panel that slides in from an edge (Radix Dialog underneath).
 * `side="left"` powers the mobile navigation, `right` suits record editors and
 * filters, `bottom` suits quick actions on phones. Include a <SheetTitle>.
 *
 *   <Sheet>
 *     <SheetTrigger asChild><Button variant="outline">Filters</Button></SheetTrigger>
 *     <SheetContent side="right">
 *       <SheetHeader>
 *         <SheetTitle>Filters</SheetTitle>
 *         <SheetDescription>Narrow down the lead list.</SheetDescription>
 *       </SheetHeader>
 *       <div className="px-5">…</div>
 *       <SheetFooter>…</SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */
import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SheetSide = "left" | "right" | "bottom";

const SIDE_CLASSES: Record<SheetSide, string> = {
  left: cn(
    "inset-y-0 left-0 h-full w-[min(20rem,calc(100%-3rem))] border-r",
    "data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left",
  ),
  right: cn(
    "inset-y-0 right-0 h-full w-[min(28rem,calc(100%-2rem))] border-l",
    "data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right",
  ),
  bottom: cn(
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]",
    "data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom",
  ),
};

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]",
        "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide;
  /** Show the × button in the top-right corner. Defaults to true. */
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-popover text-popover-foreground shadow-lg outline-none",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className={cn(
              "absolute top-4 right-4 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-foreground pointer-coarse:size-11",
              "[&_svg]:size-4",
            )}
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-5 pr-14", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-[17px] leading-snug font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
