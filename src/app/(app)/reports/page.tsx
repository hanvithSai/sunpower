/**
 * Reports: the director's deeper look at the last twelve months — how many
 * systems went in, the money, where enquiries come from and how many convert,
 * which systems sell, how profitable the jobs were and where the revenue
 * went, and what the service desk dealt with. The dashboard answers "what is
 * happening now"; this page answers "how is the business doing".
 * All figures come from getReports (src/server/services/reports.ts).
 */
import type { Metadata } from "next";
import { BadgeIndianRupee, Download, Gauge, Percent, SolarPanel, Users, Wallet } from "lucide-react";
import { RevenueTrendChart } from "@/components/modules/dashboard/revenue-trend-chart";
import { ColumnChart, RankedBars, SegmentedBar, TwoLineChart } from "@/components/modules/reports/report-charts";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatCard } from "@/components/shared/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { toDateInputValue } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getReports } from "@/server/services/reports";

export const metadata: Metadata = { title: "Reports" };

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export default async function ReportsPage() {
  await requireUser([]);
  const now = new Date();
  const r = await getReports(now);
  const month = toDateInputValue(now).slice(0, 7);
  const enquiries = r.funnel[0]?.n ?? 0;

  const exports = [
    { href: "/api/v1/reports/profit?range=all", label: "Profit per installation" },
    { href: `/api/v1/reports/payroll?month=${month}`, label: "Payroll this month" },
    { href: "/api/v1/reports/invoices", label: "Invoices" },
    { href: "/api/v1/reports/tickets", label: "Service tickets" },
  ];

  return (
    <>
      <PageHeader title="Reports" description={`How the business is doing over the last 12 months, ${r.window.from} to ${r.window.to}.`} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">Download CSV:</span>
        {exports.map((e) => (
          <a key={e.href} href={e.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Download aria-hidden="true" />
            {e.label}
          </a>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Installations" value={r.kpis.installs.toLocaleString("en-IN")} hint="Commissioned in 12 months" icon={SolarPanel} tone="brand" />
        <StatCard label="Capacity installed" value={`${r.kpis.kw.toLocaleString("en-IN")} kW`} hint="Across those installations" icon={Gauge} tone="success" />
        <StatCard label="Invoiced" value={formatINRCompact(r.kpis.revenuePaise)} hint="Excluding GST" icon={BadgeIndianRupee} tone="info" />
        <StatCard label="Cash collected" value={formatINRCompact(r.kpis.cashPaise)} hint="Advances, balances, service" icon={Wallet} tone="info" />
        <StatCard
          label="Average margin"
          value={r.kpis.marginPct === null ? "—" : `${r.kpis.marginPct}%`}
          hint={`${r.kpis.lossMakers} job${r.kpis.lossMakers === 1 ? "" : "s"} lost money`}
          icon={Percent}
          tone={r.kpis.lossMakers ? "warning" : "success"}
        />
        <StatCard
          label="Enquiry to order"
          value={r.kpis.conversionPct === null ? "—" : `${r.kpis.conversionPct}%`}
          hint={`${r.kpis.leads.toLocaleString("en-IN")} enquiries`}
          icon={Users}
          tone="neutral"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Installations per month" description="Systems commissioned each month. Hover a bar for the kW installed.">
          <ColumnChart
            data={r.installsByMonth}
            valueKey="installs"
            valueLabel="Installations"
            extra={[{ key: "kw", label: "Capacity", format: "kw" }]}
            ariaLabel="Installations commissioned per month, last 12 months"
            empty="No installations commissioned in the last 12 months."
          />
        </Section>

        <Section title="Revenue and cash" description="Invoiced (excluding GST) and cash received each month, in ₹.">
          <RevenueTrendChart data={r.moneyByMonth} />
        </Section>

        <Section title="From enquiry to order" description={`Of the ${enquiries.toLocaleString("en-IN")} enquiries received in the last 12 months.`}>
          <RankedBars
            ariaLabel="Enquiry funnel"
            empty="No enquiries in the last 12 months."
            rows={r.funnel.map((f) => ({ key: f.stage, label: f.stage, value: f.n, display: f.n.toLocaleString("en-IN"), note: pct(f.n, enquiries) }))}
          />
        </Section>

        <Section title="Where enquiries come from" description="Enquiries per channel, with how many became orders.">
          <RankedBars
            ariaLabel="Enquiries by source"
            empty="No enquiries in the last 12 months."
            rows={r.sources.map((s) => ({ key: s.key, label: s.label, value: s.leads, display: s.leads.toLocaleString("en-IN"), note: `${s.won} won (${pct(s.won, s.leads)})` }))}
          />
        </Section>

        <Section title="Systems sold" description="Orders by system type (cancelled orders excluded), with the capacity sold.">
          <SegmentedBar
            ariaLabel="Orders by system type"
            empty="No orders in the last 12 months."
            parts={r.systemMix.map((m) => ({ key: m.key, label: m.label, value: m.orders, display: `${m.orders} orders · ${m.kw.toLocaleString("en-IN")} kW` }))}
          />
        </Section>

        <Section title="Where the revenue went" description={`On ${formatINR(r.costShare.revenuePaise)} invoiced for the installations commissioned, from job costing.`}>
          <SegmentedBar
            ariaLabel="Revenue split into costs and profit"
            empty="No commissioned installations to cost yet."
            parts={r.costShare.parts.map((p) => ({ key: p.key, label: p.label, value: p.paise, display: formatINRCompact(p.paise) }))}
          />
        </Section>

        <Section title="Profit margin per installation" description="How many installations landed in each margin band. Loss-making jobs are highlighted.">
          <ColumnChart
            data={r.marginBands}
            valueKey="n"
            valueLabel="Installations"
            emphasizeLabel="Loss"
            ariaLabel="Installations by profit margin band"
            empty="No commissioned installations to cost yet."
          />
        </Section>

        <Section title="Service tickets" description="Tickets raised and closed each month.">
          <TwoLineChart
            data={r.ticketsByMonth}
            series={[
              { key: "opened", label: "Raised" },
              { key: "closed", label: "Closed" },
            ]}
            ariaLabel="Service tickets raised and closed per month"
            empty="No service tickets in the last 12 months."
          />
        </Section>

        <Section title="What customers call about" description="Tickets raised in the last 12 months, by category." className="xl:col-span-2">
          <RankedBars
            ariaLabel="Service tickets by category"
            empty="No service tickets in the last 12 months."
            rows={r.categories.map((c) => ({ key: c.key, label: c.label, value: c.n, display: c.n.toLocaleString("en-IN"), note: pct(c.n, r.kpis.tickets) }))}
          />
        </Section>
      </div>
    </>
  );
}
