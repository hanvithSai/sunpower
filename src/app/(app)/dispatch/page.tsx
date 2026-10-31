/**
 * Dispatch queue: orders to pack (soonest installation first), trucks on the
 * road, and recent deliveries. Opening one goes to its packing bench.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronRight, Truck } from "lucide-react";
import { PackingProgress } from "@/components/modules/dispatch/packing-progress";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { first, type SearchParamsRecord } from "@/lib/query";
import { requireUser } from "@/server/auth/session";
import { listDispatchQueue, type DispatchTab } from "@/server/services/dispatch";

export const metadata: Metadata = { title: "Dispatch" };

const EMPTY: Record<DispatchTab, { title: string; description: string }> = {
  to_pack: { title: "Nothing to pack", description: "Confirmed orders appear here the moment their first payment is recorded." },
  in_transit: { title: "No trucks on the road", description: "Dispatched orders wait here until delivery is confirmed." },
  delivered: { title: "No deliveries yet", description: "Delivered orders and their warranty start dates show here." },
};

export default async function DispatchPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireUser(["warehouse"]);
  const sp = await searchParams;
  const tab: DispatchTab = first(sp.tab) === "in_transit" || first(sp.tab) === "delivered" ? (first(sp.tab) as DispatchTab) : "to_pack";
  const now = new Date();
  const data = await listDispatchQueue(tab);

  return (
    <>
      <PageHeader title="Dispatch" description="Scan every serial before the truck leaves. Delivery starts each warranty by itself." />
      <div className="mb-4">
        <FilterTabs
          param="tab"
          allLabel={`To pack (${data.counts.to_pack})`}
          options={[
            { value: "in_transit", label: "In transit", count: data.counts.in_transit },
            { value: "delivered", label: "Delivered", count: data.counts.delivered },
          ]}
        />
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={Truck} title={EMPTY[tab].title} description={EMPTY[tab].description} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/dispatch/${o.id}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{o.number}</span> · {o.city}
                    </p>
                  </div>
                  <StatusBadge kind="order" status={o.status} />
                </div>
                <p className="text-sm text-foreground">{o.title}</p>
                {tab === "to_pack" ? (
                  <>
                    <PackingProgress progress={o.progress} />
                    {o.installOn ? (
                      <p className={`flex items-center gap-1.5 text-xs ${o.installOn.getTime() - now.getTime() < 2 * 86_400_000 ? "font-medium text-warning-foreground" : "text-muted-foreground"}`}>
                        <CalendarClock className="size-3.5" aria-hidden="true" />
                        Install {formatRelative(o.installOn, now)} · {formatDate(o.installOn)}
                      </p>
                    ) : null}
                  </>
                ) : tab === "in_transit" ? (
                  <p className="text-xs text-muted-foreground">
                    {o.vehicleNo} · left {o.dispatchedAt ? formatRelative(o.dispatchedAt, now) : "—"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Delivered {o.deliveredAt ? formatDateTime(o.deliveredAt) : "—"} · warranties running</p>
                )}
                <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                  {tab === "to_pack" ? "Open packing bench" : tab === "in_transit" ? "Confirm delivery" : "View"}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
