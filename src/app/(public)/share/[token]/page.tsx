/**
 * Read-only shared dashboard (no login). The token is checked against its
 * stored record on every view, so expiry and revocation take effect at once;
 * customer names are masked and nothing links into the app. Not indexed.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Download, LinkIcon } from "lucide-react";
import { DashboardView } from "@/components/modules/dashboard/dashboard-view";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/constants";
import { RANGE_LABELS, type RangeKey } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/server/services/dashboard";
import { openShareLink } from "@/server/services/finance";

export const metadata: Metadata = { title: "Shared dashboard", robots: { index: false, follow: false } };

const MESSAGES = {
  unknown: "This link isn't valid. Ask SunPower for a new one.",
  expired: "This link has expired. Ask SunPower for a new one.",
  revoked: "This link was turned off by SunPower.",
} as const;

export default async function SharedDashboardPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const now = new Date();
  const link = await openShareLink(token, now);

  if (!link.ok) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState icon={LinkIcon} title="Link unavailable" description={MESSAGES[link.reason]} />
      </div>
    );
  }

  const param = first(sp.range);
  const range: RangeKey = param === "today" || param === "week" ? param : "month";
  const data = await getDashboard(range, now, { masked: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared by {COMPANY.name} · read-only</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {RANGE_LABELS[range]}
            {link.label ? ` · for ${link.label}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(data.period.start)} – {formatDate(new Date(data.period.end.getTime() - 1))} · link expires {formatDate(link.expiresAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <nav aria-label="Period" className="flex rounded-full border border-border bg-card p-1">
            {(["month", "week", "today"] as const).map((r) => (
              <Link
                key={r}
                href={r === "month" ? `/share/${token}` : `/share/${token}?range=${r}`}
                aria-current={r === range ? "page" : undefined}
                className={cn("rounded-full px-3 py-1 text-sm", r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {RANGE_LABELS[r]}
              </Link>
            ))}
          </nav>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/v1/reports/profit?range=${range}&token=${token}`} download>
              <Download aria-hidden="true" />
              CSV
            </a>
          </Button>
        </div>
      </div>
      <DashboardView data={data} linkable={false} now={now} profitNote="Customer names are masked. Revenue excludes GST; costs are actual material, labour, site extras and warranty repairs." />
    </div>
  );
}
