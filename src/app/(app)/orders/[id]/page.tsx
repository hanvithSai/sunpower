/**
 * One order: progress, money (payments and outstanding), what the warehouse
 * packs, who installs it and when, the subsidy file, and the full timeline.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MessageCircle, Phone, Users } from "lucide-react";
import { SubsidyAdvanceDialog } from "@/components/modules/finance/subsidy-advance-dialog";
import { CancelOrderDialog } from "@/components/modules/orders/cancel-order-dialog";
import { OrderStepper } from "@/components/modules/orders/order-stepper";
import { RecordPaymentDialog } from "@/components/modules/orders/record-payment-dialog";
import { QuoteLines } from "@/components/modules/quotes/quote-lines";
import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_MODE_LABELS, PAYMENT_TYPE_LABELS, statusMeta } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone, telLink, toDateInputValue, waLink } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SUBSIDY_STEPS } from "@/lib/workflows";
import { requireUser } from "@/server/auth/session";
import { listActivity } from "@/server/services/core/activity";
import { costOrder } from "@/server/services/costing";
import { getOrderDetail } from "@/server/services/orders";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "warehouse", "support"]);
  const { id } = await params;
  const now = new Date();
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, customer, lead, quote, job, invoice, payments } = detail;
  const seesMoney = user.role === "admin" || user.role === "sales";
  const [activity, costing] = await Promise.all([listActivity("order", order.id), seesMoney ? costOrder(order.id) : Promise.resolve(null)]);

  const canTakePayment = (user.role === "sales" || user.role === "admin") && order.status !== "cancelled" && order.outstandingPaise > 0;
  const canCancel = user.role === "admin" && (order.status === "pending_payment" || order.status === "confirmed") && order.paidPaise === 0;
  const canPack = user.role === "warehouse" || user.role === "admin";
  const serialUnits = order.pickList.filter((l) => l.isSerialized).reduce((n, l) => n + l.qty, 0);
  const scanned = order.pickList.reduce((n, l) => n + l.serials.length, 0);

  return (
    <>
      <PageHeader
        title={`${order.number} · ${order.title}`}
        breadcrumbs={[{ label: "Orders", href: "/orders" }, { label: order.number }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="order" status={order.status} />
            <StatusBadge kind="payment" status={order.paymentStatus} />
            <span>
              {customer?.name} · sold by {order.salesUser} on {formatDate(order.createdAt)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canCancel ? <CancelOrderDialog orderId={order.id} /> : null}
            {canTakePayment ? (
              <RecordPaymentDialog
                orderId={order.id}
                outstandingPaise={order.outstandingPaise}
                today={toDateInputValue(now)}
                confirmsOrder={order.status === "pending_payment"}
                defaultType={order.paidPaise === 0 ? "advance" : "balance"}
              />
            ) : null}
          </div>
        }
      />

      <div className="mb-6">
        <OrderStepper status={order.status} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Order value" value={formatINR(order.totalPaise)} hint={`${formatINR(order.gstPaise)} GST`} />
        <StatCard
          label="Received"
          value={formatINR(order.paidPaise)}
          hint={order.outstandingPaise > 0 ? `${formatINR(order.outstandingPaise)} outstanding` : "Fully paid"}
          tone={order.outstandingPaise > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Subsidy"
          value={order.subsidy.applicable ? formatINR(order.subsidy.expectedPaise) : "Not eligible"}
          hint={order.subsidy.applicable ? <StatusBadge kind="subsidy" status={order.subsidy.status} /> : "Off-grid or commercial"}
        />
        <StatCard label="Site" value={`${order.capacityKw} kW`} hint={[order.siteAddress.city, order.siteAddress.pincode].join(" · ")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {costing ? (
            <Section
              title="Job costing"
              description={costing.estimated ? "Material is the quote estimate until the kit is dispatched." : "Actual cost of every serial dispatched, crew hours and anything absorbed later."}
            >
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Revenue (excl. GST)", value: costing.revenuePaise },
                  { label: "Material", value: -costing.materialPaise },
                  { label: `Labour · ${costing.labourHours} h`, value: -costing.labourPaise },
                  { label: "Site extras", value: -costing.sitePaise },
                  { label: "Warranty repairs", value: -costing.warrantyPaise },
                ].map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="tabular-nums">{formatINR(row.value)}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-muted-foreground">Profit</dt>
                  <dd className={cn("font-semibold tabular-nums", costing.profitPaise < 0 ? "text-danger-foreground" : costing.marginPct < 15 ? "text-warning-foreground" : "text-success-foreground")}>
                    {formatINR(costing.profitPaise)} · {costing.marginPct}%
                  </dd>
                </div>
              </dl>
              {order.extraCosts.length ? (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {order.extraCosts.map((e, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{e.label}</span>
                      <span className="tabular-nums">{formatINR(e.amountPaise)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>
          ) : null}

          <Section title="Bill of materials" contentClassName="p-0">
            <QuoteLines lines={order.lines} totals={order} />
          </Section>

          <Section title="Payments" description={invoice ? `Tax invoice ${invoice.number}` : "The tax invoice is issued automatically on dispatch."}>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet. The first payment confirms the order.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-mono text-xs">{p.number}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(p.receivedAt)} · {p.recordedBy}
                        </p>
                      </TableCell>
                      <TableCell>{PAYMENT_TYPE_LABELS[p.type]}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {PAYMENT_MODE_LABELS[p.mode]}
                        {p.reference ? <p className="text-xs text-muted-foreground">{p.reference}</p> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(p.amountPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Activity">
            <Timeline items={activity.map((a) => ({ id: a.id, title: a.title, at: a.at, actor: a.actor }))} />
          </Section>
        </div>

        <aside className="space-y-6">
          {customer ? (
            <Section title="Customer">
              <div className="space-y-3 text-sm">
                <p className="font-medium">{customer.name}</p>
                <p className="text-muted-foreground">
                  {[order.siteAddress.line1, order.siteAddress.city, order.siteAddress.pincode].filter(Boolean).join(", ")}
                  {customer.discom ? ` · ${customer.discom}` : ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <a href={telLink(customer.phone)}>
                      <Phone aria-hidden="true" />
                      Call
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={waLink(customer.phone)} target="_blank" rel="noreferrer">
                      <MessageCircle aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{formatPhone(customer.phone)}</p>
              </div>
            </Section>
          ) : null}

          <Section title="Installation">
            {job ? (
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <Link href={`/jobs/${job.id}`} className="font-mono text-xs text-primary hover:underline">
                    {job.number}
                  </Link>
                  <StatusBadge kind="job" status={job.status} />
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                  {formatDateTime(job.scheduledFor)}
                </p>
                <p className="flex items-start gap-2">
                  <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {job.crew.length ? job.crew.join(", ") : "Crew to be assigned"}
                </p>
                {job.status === "completed" ? (
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={`/jobs/${job.id}/certificate`}>Installation certificate</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Booked automatically when the first payment arrives.</p>
            )}
          </Section>

          <Section
            title="Warehouse"
            actions={
              canPack && order.pickList.length > 0 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dispatch/${order.id}`}>{order.status === "confirmed" || order.status === "ready_to_dispatch" ? "Pack" : "Dispatch"}</Link>
                </Button>
              ) : null
            }
          >
            {order.pickList.length === 0 ? (
              <p className="text-sm text-muted-foreground">The pick list is created when the order is confirmed.</p>
            ) : (
              <DetailList
                columns={1}
                items={[
                  { label: "Pick list", value: `${order.pickList.length} lines` },
                  { label: "Serial-tracked units", value: `${scanned} of ${serialUnits} scanned` },
                  { label: "Picked bulk items", value: `${order.pickList.filter((l) => !l.isSerialized && l.picked).length} of ${order.pickList.filter((l) => !l.isSerialized).length}` },
                ]}
              />
            )}
          </Section>

          {order.subsidy.applicable ? (
            <Section
              title="PM Surya Ghar subsidy"
              description={`${formatINR(order.subsidy.expectedPaise)} expected${order.subsidy.applicationNo ? ` · ${order.subsidy.applicationNo}` : ""}`}
              actions={seesMoney && order.status !== "cancelled" ? <SubsidyAdvanceDialog orderId={order.id} status={order.subsidy.status} expectedPaise={order.subsidy.expectedPaise} /> : null}
            >
              <ol className="space-y-1.5 text-sm">
                {SUBSIDY_STEPS.map((step) => {
                  const reached = order.subsidy.history.find((h) => h.status === step);
                  const current = order.subsidy.status === step;
                  return (
                    <li key={step} className="flex items-center justify-between gap-2">
                      <span className={cn("flex items-center gap-2", reached || current ? "text-foreground" : "text-muted-foreground")}>
                        <span className={cn("size-2 rounded-full", current ? "bg-primary" : reached ? "bg-success" : "bg-border")} aria-hidden="true" />
                        {statusMeta("subsidy", step).label}
                      </span>
                      <span className="text-xs text-muted-foreground">{reached ? formatDate(reached.at) : current ? "now" : ""}</span>
                    </li>
                  );
                })}
              </ol>
              {order.subsidy.status === "disbursed" ? <p className="mt-2 text-xs text-success-foreground">{formatINR(order.subsidy.disbursedPaise)} credited to the customer</p> : null}
              {order.subsidy.status === "rejected" ? <p className="mt-2 text-xs text-danger-foreground">Rejected — reapply after fixing the documents</p> : null}
            </Section>
          ) : null}

          <Section title="Linked records">
            <DetailList
              columns={1}
              items={[
                ...(quote ? [{ label: "Quote", value: <Link className="text-primary hover:underline" href={`/quotes/${quote.id}`}>{`${quote.number} v${quote.version}`}</Link> }] : []),
                ...(lead ? [{ label: "Lead", value: <Link className="text-primary hover:underline" href={`/leads/${lead.id}`}>{lead.number}</Link> }] : []),
                ...(invoice ? [{ label: "Invoice", value: `${invoice.number} · ${formatINR(invoice.totalPaise)}` }] : []),
              ]}
            />
          </Section>
        </aside>
      </div>
    </>
  );
}
