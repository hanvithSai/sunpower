"use client";

/**
 * Charts for /reports, built to the dataviz method:
 * - one series → one colour (forest); never two y-axes; kW, rates and amounts
 *   that aren't plotted live in the tooltip and the table view
 * - categorical colours in a fixed order (CATEGORICAL), validated with the
 *   dataviz palette script against the white card: lightness band, chroma
 *   floor, colour-blind separation of neighbours and 3:1 contrast all pass
 * - every chart has a hover tooltip and a "Show as a table" twin; ranked bars
 *   and segmented bars print their values, so nothing is tooltip-only
 * - segmented bars carry no text inside the colours (white on these hues is
 *   below 4.5:1); the legend list under the bar gives each part and its share
 * - thin marks, 4 px rounded data ends, hairline solid grid
 */
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Formats are named (not functions) so server pages can pass them to these client charts. */
export type ValueFormat = "number" | "kw" | "inr";
const FORMAT: Record<ValueFormat, (n: number) => string> = {
  number: (n) => n.toLocaleString("en-IN"),
  kw: (n) => `${n.toLocaleString("en-IN")} kW`,
  inr: (paise) => formatINRCompact(paise),
};

/** Fixed categorical order — never cycled, never re-sorted by rank. */
export const CATEGORICAL = ["#2a8a5c", "#2f7ed8", "#b8801a", "#8a63b8", "#c0603a"] as const;
const SINGLE = "#1d5c40";
const EMPHASIS = "#b42318";
const GRID = "#dbe2da";
const AXIS = { fontSize: 11, fill: "#536158" };

type Row = Record<string, string | number>;
type TipPayload = readonly { dataKey?: unknown; value?: unknown; payload?: unknown }[];

function TipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-primary">Show as a table</summary>
      <table className="mt-2 w-full text-left tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("py-1 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-t border-border">
              {r.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-1 font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="py-1 text-right">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Column chart: one series over months or ordered bands                */
/* ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  valueKey,
  valueLabel,
  ariaLabel,
  format = "number",
  extra,
  emphasizeLabel,
  empty,
}: {
  data: Row[];
  valueKey: string;
  valueLabel: string;
  ariaLabel: string;
  format?: ValueFormat;
  /** Extra lines for the tooltip and table, e.g. kW alongside installations. */
  extra?: { key: string; label: string; format: ValueFormat }[];
  /** The bar to highlight (emphasis form), e.g. the loss-making band. */
  emphasizeLabel?: string;
  empty: string;
}) {
  const formatValue = FORMAT[format];
  const isEmpty = data.every((d) => Number(d[valueKey]) === 0);
  return (
    <figure className="space-y-3">
      {isEmpty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="h-56 w-full" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} width={44} tick={AXIS} allowDecimals={false} tickFormatter={(v: number) => formatValue(v)} />
              <Tooltip
                cursor={{ fill: "rgba(15,47,36,0.05)" }}
                content={(p) => {
                  if (!p.active || !p.payload?.length) return null;
                  const row = (p.payload as TipPayload)[0]?.payload as Row;
                  return (
                    <TipBox title={String(p.label ?? "")}>
                      <p className="text-muted-foreground">
                        {valueLabel}: <span className="font-medium text-foreground tabular-nums">{formatValue(Number(row[valueKey]))}</span>
                      </p>
                      {extra?.map((e) => (
                        <p key={e.key} className="text-muted-foreground">
                          {e.label}: <span className="font-medium text-foreground tabular-nums">{FORMAT[e.format](Number(row[e.key]))}</span>
                        </p>
                      ))}
                    </TipBox>
                  );
                }}
              />
              <Bar dataKey={valueKey} name={valueLabel} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                {data.map((row) => (
                  <Cell key={String(row.label)} fill={emphasizeLabel !== undefined && row.label === emphasizeLabel ? EMPHASIS : SINGLE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <TableView
        caption={ariaLabel}
        head={["", valueLabel, ...(extra?.map((e) => e.label) ?? [])]}
        rows={data.map((d) => [String(d.label), formatValue(Number(d[valueKey])), ...(extra?.map((e) => FORMAT[e.format](Number(d[e.key]))) ?? [])])}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Two series over months (same unit, one axis)                         */
/* ------------------------------------------------------------------ */

export function TwoLineChart({
  data,
  series,
  ariaLabel,
  empty,
}: {
  data: Row[];
  series: [{ key: string; label: string }, { key: string; label: string }];
  ariaLabel: string;
  empty: string;
}) {
  const isEmpty = data.every((d) => series.every((s) => Number(d[s.key]) === 0));
  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        {series.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: CATEGORICAL[i] }} />
            {s.label}
          </span>
        ))}
      </div>
      {isEmpty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="h-56 w-full" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} width={32} tick={AXIS} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: GRID }}
                content={(p) => {
                  if (!p.active || !p.payload?.length) return null;
                  const row = (p.payload as TipPayload)[0]?.payload as Row;
                  return (
                    <TipBox title={String(p.label ?? "")}>
                      {series.map((s, i) => (
                        <p key={s.key} className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-0.5 w-3 rounded-full" style={{ background: CATEGORICAL[i] }} aria-hidden="true" />
                          {s.label}: <span className="font-medium text-foreground tabular-nums">{Number(row[s.key]).toLocaleString("en-IN")}</span>
                        </p>
                      ))}
                    </TipBox>
                  );
                }}
              />
              {series.map((s, i) => (
                <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={CATEGORICAL[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <TableView caption={ariaLabel} head={["Month", ...series.map((s) => s.label)]} rows={data.map((d) => [String(d.label), ...series.map((s) => Number(d[s.key]).toLocaleString("en-IN"))])} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked horizontal bars (one hue, values printed)                     */
/* ------------------------------------------------------------------ */

export function RankedBars({
  rows,
  ariaLabel,
  empty,
}: {
  rows: { key: string; label: string; value: number; display: string; note?: string }[];
  ariaLabel: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0 || rows.every((r) => r.value === 0)) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${r.display}${r.note ? ` (${r.note})` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground">{r.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">{r.display}</span>
              {r.note ? <span className="ml-1.5 text-xs">{r.note}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: SINGLE }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Tall segmented bar: one whole, up to five parts                      */
/* ------------------------------------------------------------------ */

export function SegmentedBar({
  parts,
  ariaLabel,
  empty,
}: {
  parts: { key: string; label: string; value: number; display: string }[];
  ariaLabel: string;
  empty: string;
}) {
  const total = parts.reduce((t, p) => t + Math.max(0, p.value), 0);
  if (total <= 0) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <figure className="space-y-3">
      <div className="flex h-12 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label={ariaLabel}>
        {parts.map((p, i) => {
          const share = Math.max(0, p.value) / total;
          if (share === 0) return null;
          return (
            <div
              key={p.key}
              title={`${p.label}: ${p.display} (${Math.round(share * 100)}%)`}
              className="h-full min-w-[3px] first:rounded-l-md last:rounded-r-md"
              style={{ width: `${share * 100}%`, background: CATEGORICAL[i] }}
            />
          );
        })}
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: CATEGORICAL[i] }} aria-hidden="true" />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {p.display} · {total ? Math.round((Math.max(0, p.value) / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
