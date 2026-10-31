/**
 * Card — the white, hairline-bordered surface that holds most content (shadcn/ui-compatible).
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Site survey</CardTitle>
 *       <CardDescription>Roof and shading details</CardDescription>
 *       <CardAction><Button size="sm">Edit</Button></CardAction>
 *     </CardHeader>
 *     <CardContent>…</CardContent>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 *
 * Padding is 20px on phones and 24px from the `sm` breakpoint. A <Table> placed directly
 * inside a Card (without CardContent) runs edge to edge and aligns its first/last cells.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-5 rounded-xl border border-border bg-card py-5 text-card-foreground shadow-sm sm:py-6",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-5 sm:px-6",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5 sm:[.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-[15px] leading-snug font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-[13px] text-muted-foreground", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5 sm:px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-5 sm:px-6 [.border-t]:pt-5 sm:[.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
