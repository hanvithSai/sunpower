/**
 * Kanban view of the sales pipeline. Each column is a stage; cards show who,
 * where, what size, the source and — for untouched leads — the SLA clock.
 */
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { REQUESTED_SYSTEM_TYPE_LABELS } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import type { LeadRow } from "@/server/services/leads";
import { SlaBadge, SourceLabel } from "./lead-badges";

export type BoardColumn = { key: string; title: string; total: number; items: LeadRow[] };

export function LeadBoard({ columns, now }: { columns: BoardColumn[]; now: Date }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
      <div className="flex min-w-max gap-4">
        {columns.map((column) => (
          <section key={column.key} aria-labelledby={`col-${column.key}`} className="w-72 shrink-0">
            <header className="mb-2 flex items-center justify-between px-1">
              <h2 id={`col-${column.key}`} className="text-sm font-semibold text-foreground">
                {column.title}
              </h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{column.total}</span>
            </header>
            <div className="min-h-28 space-y-2 rounded-2xl bg-secondary/70 p-2">
              {column.items.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">Nothing here</p>
              ) : (
                column.items.map((lead) => <LeadCard key={lead.id} lead={lead} now={now} showStatus={column.key === "survey"} />)
              )}
              {column.total > column.items.length ? (
                <p className="px-2 py-1 text-center text-xs text-muted-foreground">
                  +{column.total - column.items.length} more in the table view
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead, now, showStatus }: { lead: LeadRow; now: Date; showStatus: boolean }) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-xl border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-medium text-foreground">{lead.name}</p>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{lead.number}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {lead.city} · {lead.capacityKw} kW {REQUESTED_SYSTEM_TYPE_LABELS[lead.systemType].split(" (")[0]}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <SourceLabel source={lead.source} />
        {lead.waitingHours !== null ? (
          <SlaBadge waitingHours={lead.waitingHours} />
        ) : showStatus ? (
          <StatusBadge kind="lead" status={lead.status} />
        ) : (
          <span className="text-muted-foreground">{formatRelative(lead.lastActivityAt, now)}</span>
        )}
      </div>
      {lead.assignedToName ? <p className="mt-2 text-[11px] text-muted-foreground">Owner · {lead.assignedToName}</p> : null}
    </Link>
  );
}
