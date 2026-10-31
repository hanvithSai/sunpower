/**
 * Crew calendar: technicians down the side, Monday–Sunday across, every
 * installation and service visit in its slot (the next seven days by default). A technician booked twice on
 * one day is outlined in red. Technicians see only their own row.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { addDays, startOfDayIST } from "@/lib/dates";
import { formatTime, fromISTInput, toDateInputValue } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getJobCalendar } from "@/server/services/jobs";

export const metadata: Metadata = { title: "Installations" };

const DAY_FMT = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const CHIP_TONE: Record<string, string> = {
  scheduled: "border-info/40 bg-info/8",
  in_progress: "border-warning/60 bg-warning/12",
  completed: "border-success/40 bg-success/10",
};

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireUser(["sales", "technician"]);
  const sp = await searchParams;
  const now = new Date();
  // Default: the next seven days from today. ?week=YYYY-MM-DD shows seven days from that date.
  const week = first(sp.week);
  const picked = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? fromISTInput(week) : null;
  const cal = await getJobCalendar(picked ?? now, { rolling: true });

  const clashes = new Set(cal.clashes);
  const rows = user.role === "technician" ? cal.technicians.filter((t) => t.id === user.id) : cal.technicians;
  const todayStart = startOfDayIST(now).getTime();
  const visibleJobs = user.role === "technician" ? cal.jobs.filter((j) => j.technicianIds.includes(user.id)) : cal.jobs;
  const weekHref = (offset: number) => `/jobs?week=${toDateInputValue(addDays(cal.weekStart, offset * 7))}`;

  return (
    <>
      <PageHeader
        title="Installations"
        description="Jobs are booked automatically when an order is confirmed, with three installers who are free that day."
        actions={
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon" aria-label="Previous week">
              <Link href={weekHref(-1)}>
                <ChevronLeft aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/jobs">Next 7 days</Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Next week">
              <Link href={weekHref(1)}>
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        }
      />

      <p className="mb-3 text-sm text-muted-foreground">
        {DAY_FMT.format(cal.days[0]!)} – {DAY_FMT.format(cal.days[6]!)} · {visibleJobs.length} job{visibleJobs.length === 1 ? "" : "s"}
        {clashes.size ? <span className="font-medium text-danger-foreground"> · {clashes.size} double booking{clashes.size === 1 ? "" : "s"}</span> : null}
      </p>

      <div className="mb-8 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
          <caption className="sr-only">Crew schedule, technicians by day</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-40 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Technician
              </th>
              {cal.days.map((d) => (
                <th
                  key={d.toISOString()}
                  scope="col"
                  className={cn("px-2 py-2 text-left text-xs font-medium", d.getTime() === todayStart ? "text-primary" : "text-muted-foreground")}
                >
                  {DAY_FMT.format(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-2 text-left align-top font-medium text-foreground">
                  <span className="block truncate">{t.name}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">{t.skills.join(", ")}</span>
                </th>
                {cal.days.map((d) => {
                  const day = d.getTime();
                  const jobs = cal.jobs.filter((j) => j.dayStart.getTime() === day && j.technicianIds.includes(t.id));
                  const clash = clashes.has(`${t.id}|${day}`);
                  return (
                    <td key={day} className={cn("px-1.5 py-1.5 align-top", day === todayStart && "bg-primary/4")}>
                      <div className="space-y-1">
                        {jobs.map((j) => (
                          <Link
                            key={j.id}
                            href={`/jobs/${j.id}`}
                            className={cn(
                              "block rounded-lg border px-2 py-1 text-[11px] leading-tight hover:border-primary",
                              CHIP_TONE[j.status] ?? "border-border",
                              clash && "border-danger ring-1 ring-danger",
                            )}
                            title={`${j.number} · ${j.title} · ${j.customerName}`}
                          >
                            <span className="block truncate font-medium text-foreground">{j.customerName}</span>
                            <span className="block truncate text-muted-foreground">
                              {formatTime(j.scheduledFor)} · {j.city}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-base font-semibold text-foreground">Jobs in these 7 days</h2>
      {visibleJobs.length === 0 ? (
        <EmptyState icon={Wrench} title="No jobs in these 7 days" description="Installations appear here as soon as an order's first payment is recorded." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {visibleJobs.map((j) => (
            <li key={j.id}>
              <Link href={`/jobs/${j.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-secondary/50">
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{j.customerName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {DAY_FMT.format(j.scheduledFor)} {formatTime(j.scheduledFor)} · {j.title} · <span className="font-mono">{j.number}</span>
                    {j.orderNumber ? ` · ${j.orderNumber}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {j.orderStatus ? <StatusBadge kind="order" status={j.orderStatus} /> : null}
                  <StatusBadge kind="job" status={j.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
