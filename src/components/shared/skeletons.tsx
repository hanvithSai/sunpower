/**
 * Ready-made loading layouts used by loading.tsx files and <Suspense> fallbacks.
 * Each exported skeleton is a polite `role="status"` region with screen-reader text;
 * the inner building blocks are purely decorative. Server-safe and static.
 *
 *   PageSkeleton      — header + KPI row + table (generic page)
 *   TableSkeleton     — a card with a table, `rows` long (default 5)
 *   CardGridSkeleton  — a row of KPI cards, `count` long (default 4)
 *   DetailSkeleton    — a record page: header, details card and activity sidebar
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function HeaderBlock() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg" />
    </div>
  );
}

function CardGridBlock({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

const CELL_WIDTHS = ["w-40", "w-24", "w-28", "w-20", "w-16"];

function TableBlock({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
        <Skeleton className="hidden h-8 w-48 rounded-full sm:block" />
      </div>
      <div className="flex gap-6 border-y border-border bg-muted/60 px-5 py-3">
        {CELL_WIDTHS.map((width, index) => (
          <Skeleton key={width} className={cn("h-3", index === 0 ? "w-24" : "w-14", index > 2 && "hidden md:block")} />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-6 px-5 py-3.5">
            <div className="flex w-40 items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
            {CELL_WIDTHS.slice(1).map((width, index) => (
              <Skeleton key={width} className={cn("h-3.5", width, index > 1 && "hidden md:block")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <LoadingRegion label="Loading page…" className="space-y-6">
      <HeaderBlock />
      <CardGridBlock count={4} />
      <TableBlock rows={6} />
    </LoadingRegion>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading table…">
      <TableBlock rows={rows} />
    </LoadingRegion>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading summary…">
      <CardGridBlock count={count} />
    </LoadingRegion>
  );
}

export function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading details…" className="space-y-6">
      <HeaderBlock />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[0, 1].map((card) => (
            <div key={card} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <Skeleton className="h-4 w-32" />
              <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-36 max-w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-4 w-24" />
          <div className="mt-5 space-y-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="mt-1 size-2.5 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
