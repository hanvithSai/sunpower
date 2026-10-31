/**
 * Site surveys: sales sees every survey; a technician sees only their own,
 * soonest first, so the day's visits are obvious.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SURVEY_STATUSES, statusMeta } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listSurveys } from "@/server/services/surveys";

export const metadata: Metadata = { title: "Surveys" };

export default async function SurveysPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["sales", "technician"]);
  const sp = await searchParams;
  const now = new Date();
  const technicianId = user.role === "technician" ? user.id : undefined;

  const data = await listSurveys({
    status: first(sp.status),
    technicianId,
    page: Number(first(sp.page)) || 1,
  });

  return (
    <>
      <PageHeader
        title={technicianId ? "My surveys" : "Site surveys"}
        description={
          technicianId
            ? "Roof measurements you have been booked for. Submit each one from the roof."
            : "Book surveys from a qualified lead. Approve completed surveys to unlock the quote."
        }
      />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={SURVEY_STATUSES.map((s) => ({ value: s, label: statusMeta("survey", s).label, count: data.counts[s] ?? 0 }))}
        />
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No surveys here"
          description={technicianId ? "New survey bookings will appear here." : "Qualify a lead and book a survey from the lead page."}
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Survey</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="hidden md:table-cell">Technician</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Recommends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/surveys/${s.id}`} className="font-medium text-foreground hover:text-primary">
                        {s.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{s.number}</span> · {s.city}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(s.scheduledFor)}
                      <p className="text-xs text-muted-foreground">{formatRelative(s.scheduledFor, now)}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{s.technicianName}</TableCell>
                    <TableCell>
                      <StatusBadge kind="survey" status={s.status} />
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">{s.recommendedKw ? `${s.recommendedKw} kW` : "—"}</TableCell>
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
