"use client";

/**
 * DropdownMenu — an accessible action menu built on Radix (shadcn/ui-compatible).
 * Full keyboard support (arrows, type-ahead, Esc). Use `asChild` on an item to render
 * a Next.js <Link>, and `variant="destructive"` for irreversible actions.
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><Button variant="ghost" size="icon">…</Button></DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuLabel>Lead</DropdownMenuLabel>
 *       <DropdownMenuItem asChild><Link href="/leads/42">Open</Link></DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuItem variant="destructive" onSelect={…}>Mark as lost</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal(props: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-48 overflow-x-hidden overflow-y-auto",
          "rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
          "origin-(--radix-dropdown-menu-content-transform-origin)",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** Indent to line up with items that have a leading icon. */
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none",
        "data-highlighted:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50",
        "data-inset:pl-9 pointer-coarse:py-2.5",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        "data-[variant=destructive]:text-danger-foreground data-[variant=destructive]:data-highlighted:bg-danger/10",
        "data-[variant=destructive]:[&_svg:not([class*='text-'])]:text-danger-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset ? "" : undefined}
      className={cn("px-2.5 py-1.5 text-xs font-medium text-muted-foreground data-inset:pl-9", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
};
