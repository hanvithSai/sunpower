/**
 * The director's dashboard body, shared by /dashboard and the read-only
 * /share/[token] view: KPIs for the period, the 12-month trend, profit per
 * installation (losers first, with what drove the cost), every customer still
 * waiting on a step, open repairs by age and the subsidy pipeline.
 * `linkable` is false on the public share view (no links into the app).
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, Clock, Headset, IndianRupee, Landmark, PiggyBank, Sun, TrendingUp, UserPlus } from "lucide-react";
import { RevenueTrendChart } from "@/components/modules/dashboard/revenue-trend-chart";
import { Section } from "@/components/shared/section";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusMeta } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/server/services/dashboard";

function delta(cur: number, prev: number): { value: string; positive: boolean } | undefined {
  if (!prev) return undefined;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { value: `${pct > 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
}

function MaybeLink({ href, linkable, className, children }: { href: string; linkable: boolean; className?: string; children: ReactNode }) {
  return linkable ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

export function DashboardView({ data, linkable, now, profitNote }: { data: DashboardData; linkable: boolean; now: Date; profitNote?: ReactNode }) {
  const { kpis } = data;
  const losers = data.profit.filter((p) => p.profitPaise < 0).length;
  const waiting = data.unfinished.reduce((n, s) => n + s.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Invoiced (excl. GST)" value={formatINRCompact(kpis.revenuePaise)} hint={formatINR(kpis.revenuePaise)} icon={TrendingUp} tone="brand" trend={delta(kpis.revenuePaise, kpis.revenuePrevPaise)} />
        <StatCard label="Cash collected" value={formatINRCompact(kpis.cashPaise)} hint="Advances, balances and service bills" icon={Banknote} tone="success" trend={delta(kpis.cashPaise, kpis.cashPrevPaise)} />
        <StatCard
          label="Advances held"
          value={formatINRCompact(kpis.advancesHeldPaise)}
          hint={`${kpis.advancesOrders} order${kpis.advancesOrders === 1 ? "" : "s"} paid, not yet installed`}
          icon={PiggyBank}
          tone="warning"
        />
        <StatCard
          label="Margin on installs"
          value={kpis.marginPct === null ? "—" : `${kpis.marginPct}%`}
          hint={`${kpis.commissioned} commissioned${losers ? ` · ${losers} at a loss` : ""}`}
          icon={Sun}
          tone={kpis.marginPct !== null && kpis.marginPct < 15 ? "danger" : "info"}
        />
        <StatCard label="Stock purchased" value={formatINRCompact(kpis.purchasedPaise)} hint={`${kpis.purchases} goods receipt${kpis.purchases === 1 ? "" : "s"}`} icon={Boxes} tone="neutral" href={linkable ? "/inventory/purchases" : undefined} />
        <StatCard label="Technician hours" value={kpis.hoursLogged.toLocaleString("en-IN")} hint="Installations and service visits" icon={Clock} tone="neutral" href={linkable ? "/team" : undefined} />
        <StatCard label="New enquiries" value={kpis.newLeads} icon={UserPlus} tone="info" trend={delta(kpis.newLeads, kpis.newLeadsPrev)} href={linkable ? "/leads" : undefined} />
        <StatCard label="Open repairs" value={kpis.openTickets} hint={`${waiting} customer steps waiting`} icon={Headset} tone={kpis.openTickets ? "warning" : "success"} href={linkable ? "/service" : undefined} />
      </div>

      <Section title="Revenue and cash, last 12 months">
        <RevenueTrendChart data={data.trend} />
      </Section>

      <Section
        title="Profit per installation"
        description={profitNote ?? "Revenue excl. GST minus material at GRN cost, crew hours × rate, site extras and warranty repairs. Worst first."}
        contentClassName="p-0"
      >
        {data.profit.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No installations commissioned in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Installation</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Material</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Labour</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Site extras</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Warranty</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.profit.map((p) => (
                  <TableRow key={p.id} className={cn(p.profitPaise < 0 && "bg-danger/6")}>
                    <TableCell>
                      <MaybeLink href={`/orders/${p.id}`} linkable={linkable} className="font-medium text-foreground hover:text-primary">
                        {p.customer}
                      </MaybeLink>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{p.number}</span> · {p.capacityKw} kW · {p.city}
                        {p.commissionedAt ? ` · ${formatDate(p.commissionedAt)}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(p.revenuePaise)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatINR(p.materialPaise)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell" title={`${p.labourHours} h`}>
                      {formatINR(p.labourPaise)}
                    </TableCell>
                    <TableCell className={cn("hidden text-right tabular-nums lg:table-cell", p.sitePaise ? "text-foreground" : "text-muted-foreground")}>{formatINR(p.sitePaise)}</TableCell>
                    <TableCell className={cn("hidden text-right tabular-nums lg:table-cell", p.warrantyPaise ? "text-foreground" : "text-muted-foreground")}>{formatINR(p.warrantyPaise)}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", p.profitPaise < 0 ? "text-danger-foreground" : "text-foreground")}>{formatINR(p.profitPaise)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                          p.marginPct < 0 ? "bg-danger/12 text-danger-foreground" : p.marginPct < 15 ? "bg-warning/14 text-warning-foreground" : "bg-success/12 text-success-foreground",
                        )}
                      >
                        {p.marginPct < 15 ? <AlertTriangle className="size-3" aria-label={p.marginPct < 0 ? "Loss" : "Low margin"} /> : null}
                        {p.marginPct}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Still unfinished" description="Every customer waiting on a step, and who acts next.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.unfinished.map((step) => (
            <div key={step.key} className={cn("rounded-xl border p-3", step.count ? "border-warning/40 bg-warning/5" : "border-border")}>
              <div className="flex items-start justify-between gap-2">
                <MaybeLink href={step.href} linkable={linkable} className="text-sm font-medium text-foreground hover:text-primary">
                  {step.label}
                </MaybeLink>
                <span className={cn("text-xl font-semibold tabular-nums", step.count ? "text-warning-foreground" : "text-muted-foreground")}>{step.count}</span>
              </div>
              <p className="text-xs text-muted-foreground">Next: {step.owner}</p>
              {step.items.length ? (
                <ul className="mt-2 space-y-1">
                  {step.items.slice(0, 3).map((item) => (
                    <li key={item.id} className="text-xs">
                      <MaybeLink href={item.href} linkable={linkable} className="block truncate text-foreground hover:text-primary">
                        {item.title}
                      </MaybeLink>
                      <span className="block truncate text-muted-foreground">
                        {item.subtitle} · {formatRelative(item.since, now)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Open repairs by age">
          <div className="grid grid-cols-4 gap-2 text-center">
            {data.repairs.byAge.map((a, i) => (
              <div key={a.label} className={cn("rounded-xl border p-2", i === 3 && a.count ? "border-danger/40 bg-danger/6" : "border-border")}>
                <p className="text-xl font-semibold tabular-nums">{a.count}</p>
                <p className="text-[11px] text-muted-foreground">{a.label}</p>
              </div>
            ))}
          </div>
          {data.repairs.oldest.length ? (
            <ul className="mt-3 divide-y divide-border text-sm">
              {data.repairs.oldest.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <MaybeLink href={`/service/${t.id}`} linkable={linkable} className="min-w-0 truncate hover:text-primary">
                    <span className="font-mono text-xs">{t.number}</span> · {t.customer}
                  </MaybeLink>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge kind="ticket" status={t.status} />
                    <span className="text-xs text-muted-foreground">{formatRelative(t.createdAt, now)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="PM Surya Ghar subsidy" description="Residential on-grid customers, by stage.">
          <ul className="space-y-2">
            {data.subsidy
              .filter((s) => s.count > 0 || s.status !== "rejected")
              .map((s) => (
                <li key={s.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
                    {statusMeta("subsidy", s.status).label}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-medium">{s.count}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatINR(s.status === "disbursed" ? s.disbursedPaise : s.expectedPaise)}</span>
                  </span>
                </li>
              ))}
          </ul>
          {linkable ? (
            <Link href="/subsidy" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <IndianRupee className="size-3.5" aria-hidden="true" />
              Open the subsidy board
            </Link>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
