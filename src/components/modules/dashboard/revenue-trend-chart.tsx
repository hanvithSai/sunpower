"use client";

/**
 * Twelve months of invoiced revenue (excl. GST) and cash collected — two
 * measures in the same unit, so one ₹ axis and grouped bars. Colours were run
 * through the dataviz palette validator against the white card (both pass the
 * lightness, CVD and 3:1 contrast checks); identity is never colour-alone: the
 * legend names both series and the hover tooltip spells out each value. A
 * table view sits under the chart for screen readers and exact figures.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR, formatINRCompact } from "@/lib/money";

const SERIES = [
  { key: "revenuePaise", label: "Invoiced (excl. GST)", color: "#1d5c40" },
  { key: "cashPaise", label: "Cash collected", color: "#b8801a" },
] as const;

export type TrendPoint = { key: string; label: string; revenuePaise: number; cashPaise: number };

type TooltipProps = { active?: boolean; label?: unknown; payload?: readonly { dataKey?: unknown; value?: unknown }[] };

function TrendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{String(label ?? "")}</p>
      {SERIES.map((s) => {
        const value = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <p key={s.key} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            {s.label}: <span className="font-medium tabular-nums text-foreground">{formatINR(Number(value))}</span>
          </p>
        );
      })}
    </div>
  );
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  const empty = data.every((d) => d.revenuePaise === 0 && d.cashPaise === 0);
  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No invoices or payments in the last 12 months yet.</p>
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Monthly invoiced revenue and cash collected, last 12 months">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#dbe2da" strokeDasharray="0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#536158" }} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "#536158" }} tickFormatter={(v: number) => formatINRCompact(v)} />
              <Tooltip content={(props) => <TrendTooltip active={props.active} label={props.label} payload={props.payload} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-primary">Show as a table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <caption className="sr-only">Monthly invoiced revenue and cash collected</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 font-medium">Month</th>
              {SERIES.map((s) => (
                <th key={s.key} scope="col" className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-border">
                <th scope="row" className="py-1 font-normal">
                  {d.label}
                </th>
                <td className="py-1 text-right">{formatINR(d.revenuePaise)}</td>
                <td className="py-1 text-right">{formatINR(d.cashPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
