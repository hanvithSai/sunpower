/**
 * Service tickets: every complaint until the customer confirms it's fixed.
 * Overdue tickets (past their priority SLA) are flagged; technicians see only
 * the tickets assigned to them.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Headset, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TICKET_CATEGORY_LABELS, TICKET_STATUSES, statusMeta } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listTickets } from "@/server/services/tickets";

export const metadata: Metadata = { title: "Service tickets" };

export default async function ServicePage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["support", "technician"]);
  const sp = await searchParams;
  const now = new Date();
  const status = first(sp.status) ?? "open_all";
  const data = await listTickets(
    { status, q: first(sp.q), page: Number(first(sp.page)) || 1, assignedTo: user.role === "technician" ? user.id : undefined },
    now,
  );
  const canRaise = user.role === "support" || user.role === "admin";

  return (
    <>
      <PageHeader
        title="Service tickets"
        description="Warranty is decided when the ticket is raised. Tickets close only after the customer confirms the fix."
        actions={
          canRaise ? (
            <Button asChild>
              <Link href="/service/new">
                <Plus aria-hidden="true" />
                New ticket
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          param="status"
          allLabel={`Open (${data.openCount})`}
          options={[
            ...TICKET_STATUSES.map((s) => ({ value: s, label: statusMeta("ticket", s).label, count: data.counts[s] ?? 0 })),
          ]}
        />
        <div className="w-full lg:w-80">
          <SearchInput placeholder="Customer, phone, serial or SP-T-…" />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={Headset} title="No tickets here" description="Raise one from ⌘K: type the customer's phone or the serial on the inverter." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead className="hidden md:table-cell">Unit</TableHead>
                  <TableHead>Cover</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Technician</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/service/${t.id}`} className="font-medium text-foreground hover:text-primary">
                        {t.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{t.number}</span> · {TICKET_CATEGORY_LABELS[t.category]}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {t.serial ? (
                        <>
                          <p className="font-mono text-xs">{t.serial}</p>
                          <p className="text-xs text-muted-foreground">{t.productName}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No serial · {t.city}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.billable ? "warning" : "success"}>{t.billable ? "Billable" : "₹0 · warranty"}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge kind="ticket" status={t.status} />
                        <StatusBadge kind="priority" status={t.priority} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{t.assignedTo ?? <span className="text-muted-foreground">Not booked</span>}</TableCell>
                    <TableCell className={`hidden whitespace-nowrap text-right text-xs sm:table-cell ${t.overdue ? "font-semibold text-danger-foreground" : "text-muted-foreground"}`}>
                      {["resolved", "customer_confirmed", "closed"].includes(t.status) ? formatRelative(t.createdAt, now) : t.overdue ? `Overdue ${formatRelative(t.slaDueAt, now)}` : `Due ${formatRelative(t.slaDueAt, now)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} />
        </div>
      )}
    </>
  );
}
