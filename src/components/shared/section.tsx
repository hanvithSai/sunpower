/**
 * Section — a titled card: the building block of detail pages and dashboards.
 *
 *   <Section title="Payments" description="Advance and balance received" actions={<Button size="sm">Record</Button>}>
 *     …
 *   </Section>
 *
 * For an edge-to-edge table pass `contentClassName="p-0"`; the Table's first/last cells
 * already line up with the 20px card padding. Server-safe.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SectionProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function Section({ title, description, actions, children, className, contentClassName }: SectionProps) {
  return (
    <section
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[15px] leading-snug font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <div className="text-[13px] text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-print-hide>
            {actions}
          </div>
        ) : null}
      </div>
      <div className={cn("px-5 pt-4 pb-5", contentClassName)}>{children}</div>
    </section>
  );
}
