/**
 * Timeline — a vertical activity log (status changes, calls, visits, payments).
 *
 *   <Timeline
 *     items={activities.map((a) => ({
 *       id: a.id, title: a.summary, description: a.note, at: a.createdAt, actor: a.byName,
 *     }))}
 *   />
 *
 * Pass items newest first; the newest dot is highlighted. Times render in IST with
 * formatDateTime so server and browser output always match. Server-safe.
 */
import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  at: Date | string;
  actor?: string;
};

export type TimelineProps = {
  items: TimelineItem[];
  emptyText?: string;
};

function toIso(value: Date | string): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function Timeline({ items, emptyText = "No activity yet." }: TimelineProps) {
  if (items.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ol className="relative">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span aria-hidden="true" className="absolute top-4 bottom-0 left-1.25 w-px bg-border" />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-1.5 size-2.75 shrink-0 rounded-full border-2 border-card",
                isFirst ? "bg-primary ring-4 ring-primary/12" : "bg-[#c7c7cc]",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              {item.description ? <div className="mt-0.5 text-[13px] text-muted-foreground">{item.description}</div> : null}
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                <time dateTime={toIso(item.at)}>{formatDateTime(item.at)}</time>
                {item.actor ? <span> · {item.actor}</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
