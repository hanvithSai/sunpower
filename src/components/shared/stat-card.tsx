/**
 * StatCard — a KPI tile for dashboards and module overviews.
 *
 *   <StatCard
 *     label="Open tickets"
 *     value={14}
 *     hint="3 breaching SLA"
 *     icon={Headset}
 *     tone="danger"
 *     trend={{ value: "-12%", positive: true }}
 *     href="/service?status=open"
 *   />
 *
 * `tone` colours the icon tile (brand uses the SunPower sun gradient). `trend.positive`
 * decides the colour (good = green, bad = red); the arrow follows the sign of `trend.value`.
 * With `href` the whole card is a link. Server-safe.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  trend?: { value: string; positive: boolean };
  href?: string;
};

const ICON_TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-foreground/70",
  info: "bg-info/12 text-info",
  warning: "bg-warning/14 text-warning-foreground",
  success: "bg-success/14 text-success-foreground",
  danger: "bg-danger/12 text-danger",
  brand: "bg-linear-to-b from-brand-light to-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", trend, href }: StatCardProps) {
  const isDown = trend ? /^[-−–]/.test(trend.value.trim()) : false;
  const TrendIcon = isDown ? ArrowDownRight : ArrowUpRight;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] leading-5 font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", ICON_TONES[tone])}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <div className="text-[28px] leading-9 font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              trend.positive ? "text-success-foreground" : "text-danger-foreground",
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden="true" />
            {trend.value}
            <span className="sr-only">{trend.positive ? " (improving)" : " (needs attention)"}</span>
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-[13px] text-muted-foreground">{hint}</div> : null}
    </>
  );

  const surface = "flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm";

  if (href) {
    return (
      <Link
        href={href}
        data-slot="card"
        className={cn(
          surface,
          "transition-[border-color,box-shadow] duration-150 ease-out hover:border-input hover:shadow-md",
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <div data-slot="card" className={surface}>
      {body}
    </div>
  );
}
