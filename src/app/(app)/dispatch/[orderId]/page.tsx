/**
 * Packing bench for one order: scan its serials, tick its bulk lines, dispatch
 * (which issues the tax invoice) and confirm delivery (which starts every
 * warranty). Built for a phone or tablet at the warehouse door.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FileText, MapPin, Truck } from "lucide-react";
import { DeliverDialog, DispatchDialog } from "@/components/modules/dispatch/dispatch-dialogs";
import { PackingBench } from "@/components/modules/dispatch/packing-bench";
import { PackingProgress } from "@/components/modules/dispatch/packing-progress";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getDispatchDetail } from "@/server/services/dispatch";

export const metadata: Metadata = { title: "Packing bench" };

export default async function DispatchOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireUser(["warehouse"]);
  const { orderId } = await params;
  const detail = await getDispatchDetail(orderId);
  if (!detail) notFound();
  const { order, customer, job, invoice, lines, progress, canPack } = detail;

  const missing = [
    progress.serialRequired - progress.serialScanned > 0 ? `${progress.serialRequired - progress.serialScanned} serials to scan` : null,
    progress.bulkLines - progress.bulkPicked > 0 ? `${progress.bulkLines - progress.bulkPicked} bulk lines to tick` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        title={`${order.number} · ${customer?.name ?? ""}`}
        breadcrumbs={[{ label: "Dispatch", href: "/dispatch" }, { label: order.number }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="order" status={order.status} />
            <span>{order.title}</span>
            <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
              Open order
            </Link>
          </span>
        }
        actions={
          canPack ? (
            <DispatchDialog orderId={order.id} ready={progress.complete} missing={missing ? `Still to do: ${missing}` : ""} />
          ) : order.status === "dispatched" ? (
            <DeliverDialog orderId={order.id} customerName={customer?.name ?? ""} />
          ) : null
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">Packing</p>
          <PackingProgress progress={progress} className="mt-2" />
          {canPack && !progress.complete ? <p className="mt-1 text-xs text-warning-foreground">Still to do: {missing}</p> : null}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
          <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">Deliver to</p>
          <p className="mt-2 flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {[order.siteAddress.line1, order.siteAddress.city, order.siteAddress.pincode].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
          <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">Installation</p>
          {job ? (
            <>
              <p className="mt-2 flex items-center gap-1.5">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                {formatDateTime(job.scheduledFor)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{job.crew.join(", ") || "Crew to be assigned"}</p>
            </>
          ) : (
            <p className="mt-2 text-muted-foreground">Not booked</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
          <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">{invoice ? "Tax invoice" : "Truck"}</p>
          {invoice ? (
            <>
              <p className="mt-2 flex items-center gap-1.5">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="font-mono text-xs">{invoice.number}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatINR(invoice.totalPaise)} · <StatusBadge kind="invoice" status={invoice.status} />
              </p>
            </>
          ) : (
            <p className="mt-2 text-muted-foreground">Invoice is issued on dispatch</p>
          )}
          {order.dispatch.vehicleNo ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Truck className="size-3.5" aria-hidden="true" />
              {order.dispatch.vehicleNo} · {order.dispatch.driverName}
              {order.dispatch.deliveredAt ? ` · delivered ${formatDate(order.dispatch.deliveredAt)}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <PackingBench orderId={order.id} lines={lines} canPack={canPack} />
    </>
  );
}
