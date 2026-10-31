/**
 * Team & payroll: each technician's hours for the month (installations and
 * service visits, from the time logs written when jobs complete) × their
 * hourly rate, with the payout total and a CSV for accounts.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Download, IndianRupee, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhone, toDateInputValue } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/money";
import { first, type SearchParamsRecord } from "@/lib/query";
import { MonthSchema } from "@/lib/validation/finance";
import { requireUser } from "@/server/auth/session";
import { getPayroll } from "@/server/services/finance";

export const metadata: Metadata = { title: "Team & payroll" };

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser([]);
  const sp = await searchParams;
  const current = toDateInputValue(new Date()).slice(0, 7);
  const param = first(sp.month);
  const month = param && MonthSchema.safeParse(param).success && param <= current ? param : current;
  const payroll = await getPayroll(month);
  const label = MONTH_FMT.format(new Date(`${month}-15T00:00:00+05:30`));
  const people = [...payroll.people].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Team & payroll"
        description="Hours come from the time logs written when installations and service visits are completed."
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <Button asChild variant="outline" size="icon" aria-label="Previous month">
              <Link href={`/team?month=${shiftMonth(month, -1)}`}>
                <ChevronLeft aria-hidden="true" />
              </Link>
            </Button>
            <span className="min-w-36 px-2 text-center text-sm font-medium">{label}</span>
            {month < current ? (
              <Button asChild variant="outline" size="icon" aria-label="Next month">
                <Link href={`/team?month=${shiftMonth(month, 1)}`}>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <span className="size-9" />
            )}
            <Button asChild variant="outline" className="ml-2">
              <a href={`/api/v1/reports/payroll?month=${month}`} download>
                <Download aria-hidden="true" />
                CSV
              </a>
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Payout this month" value={formatINRCompact(payroll.totals.payPaise)} hint={formatINR(payroll.totals.payPaise)} icon={IndianRupee} tone="brand" />
        <StatCard label="Hours logged" value={payroll.totals.hours.toLocaleString("en-IN")} hint={`${people.filter((p) => p.hours > 0).length} of ${people.length} technicians worked`} icon={Clock} tone="info" />
        <StatCard label="Jobs and visits" value={payroll.totals.jobs} icon={Wrench} tone="neutral" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Technician</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Rate</TableHead>
              <TableHead className="hidden text-right md:table-cell">Installations</TableHead>
              <TableHead className="hidden text-right md:table-cell">Service</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id} className={p.hours === 0 ? "text-muted-foreground" : undefined}>
                <TableCell>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {formatPhone(p.phone)}
                    {p.skills.map((s) => (
                      <Badge key={s} variant="neutral">
                        {s}
                      </Badge>
                    ))}
                  </p>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatINR(p.ratePaise)}/h</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{p.installHours || "—"}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{p.serviceHours || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{p.hours}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatINR(p.payPaise)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
