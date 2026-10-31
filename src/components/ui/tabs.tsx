"use client";

/**
 * Tabs — an Apple-style segmented control built on Radix Tabs (shadcn/ui-compatible).
 * Arrow keys move between triggers; content panels are linked for screen readers.
 * For URL-driven filters on list pages use <FilterTabs> instead (works with links).
 *
 *   <Tabs defaultValue="overview">
 *     <TabsList>
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="payments">Payments</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">…</TabsContent>
 *   </Tabs>
 */
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 w-fit items-center gap-0.5 rounded-lg bg-secondary p-0.5 text-muted-foreground",
        "pointer-coarse:h-11",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap",
        "text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-out hover:text-foreground",
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgb(0_0_0/0.1),0_1px_1px_rgb(0_0_0/0.04)]",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
