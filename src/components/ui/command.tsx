"use client";

/**
 * Command — searchable, keyboard-first list built on cmdk (shadcn/ui-compatible).
 * Powers the global ⌘K palette (src/components/shell/command-palette.tsx) and can be
 * reused for any "pick one of many" list. `CommandDialog` puts it in a modal; pass
 * `commandProps={{ shouldFilter: false }}` when results come from the server.
 */
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command palette",
  description = "Search for a page or record to open.",
  children,
  className,
  showCloseButton = false,
  commandProps,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  /** Props for the inner <Command>, e.g. `{ shouldFilter: false, loop: true }`. */
  commandProps?: React.ComponentProps<typeof CommandPrimitive>;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          "top-[12dvh] max-h-[min(36rem,80dvh)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl",
          className,
        )}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command {...commandProps} className={cn("min-h-0 rounded-none", commandProps?.className)}>
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-13 shrink-0 items-center gap-3 border-b border-border px-4">
      <SearchIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-full w-full bg-transparent text-[15px] text-foreground outline-none",
          "placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:text-base",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-[min(26rem,55dvh)] scroll-py-2 overflow-x-hidden overflow-y-auto p-2", className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("px-4 py-10 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-foreground not-first:pt-2",
        "**:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-1 **:[[cmdk-group-heading]]:pb-1.5",
        "**:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-2 my-2 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none select-none",
        "data-[selected=true]:bg-accent data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "pointer-coarse:py-3",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
