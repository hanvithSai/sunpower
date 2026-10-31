/**
 * Customer 360: one customer's whole history on one screen, from the first
 * enquiry to the end of the panel warranty. Orders with what is paid and due,
 * every serial on the roof with its own warranty, the workmanship warranty,
 * tickets, invoices, payments and the timeline. Links open only the records
 * the viewer's role can act on.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Headset, MessageCircle, Phone } from "lucide-react";
import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSTOMER_TYPE_LABELS, LEAD_SOURCE_LABELS, PAYMENT_MODE_LABELS, PRODUCT_CATEGORY_LABELS, SYSTEM_TYPE_LABELS, TICKET_CATEGORY_LABELS, type Role } from "@/lib/constants";
import { formatDate, formatPhone, telLink, waLink } from "@/lib/format";
import { formatINR, formatINRCompact } from "@/lib/money";
import { canAccess } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { listCustomerActivity } from "@/server/services/core/activity";
import { getCustomer360 } from "@/server/services/customers";

export const metadata: Metadata = { title: "Customer" };

const ROUTE_ROLES = {
  lead: ["sales", "support"],
  quote: ["sales"],
  order: ["sales", "warehouse", "support"],
  ticket: ["support", "technician"],
  raiseTicket: ["support"],
  invoice: ["sales", "support"],
  job: ["sales", "technician", "warehouse", "support"],
} satisfies Record<string, Role[]>;

function MaybeLink({ href, show, children, className }: { href: string; show: boolean; children: ReactNode; className?: string }) {
  return show ? (
    <Link href={href} className={cn("font-medium text-foreground hover:text-primary", className)}>
      {children}
    </Link>
  ) : (
    <span className={cn("font-medium text-foreground", className)}>{children}</span>
  );
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "support"]);
  const { id } = await params;
  const now = new Date();
  const data = await getCustomer360(id, now);
  if (!data) notFound();
  const activity = await listCustomerActivity(id, 60);
  const { customer, totals } = data;
  const can = (key: keyof typeof ROUTE_ROLES) => canAccess(user.role, ROUTE_ROLES[key]);

  return (
    <>
      <PageHeader
        title={customer.name}
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant={customer.type === "commercial" ? "brand" : "neutral"}>{CUSTOMER_TYPE_LABELS[customer.type]}</Badge>
            <span>
              {formatPhone(customer.phone)} · {customer.address.city} · customer since {formatDate(customer.since)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
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
            {can("raiseTicket") && data.orders.some((o) => o.deliveredAt) ? (
              <Button asChild>
                <Link href={`/service/new?customerId=${customer.id}`}>
                  <Headset aria-hidden="true" />
                  Raise ticket
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Systems" value={totals.orders ? `${totals.kw} kW` : "None yet"} hint={`${totals.orders} order${totals.orders === 1 ? "" : "s"}`} />
        <StatCard
          label="Billed"
          value={formatINRCompact(totals.billedPaise)}
          hint={totals.duePaise > 0 ? `${formatINR(totals.duePaise)} due` : totals.orders ? "Fully paid" : "—"}
          tone={totals.duePaise > 0 ? "warning" : "neutral"}
        />
        <StatCard label="Units in warranty" value={`${totals.inWarranty} of ${totals.units}`} hint="Serial-tracked panels, inverters, batteries" tone={totals.units && totals.inWarranty < totals.units ? "warning" : "success"} />
        <StatCard label="Open tickets" value={totals.openTickets} hint={totals.openTickets ? "Not closed yet" : "Nothing open"} tone={totals.openTickets ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Orders" description="Workmanship warranty runs from commissioning." contentClassName="p-0">
            {data.orders.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="hidden md:table-cell">Workmanship</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <MaybeLink href={`/orders/${o.id}`} show={can("order")}>
                          {o.number}
                        </MaybeLink>
                        <p className="text-xs text-muted-foreground">
                          {o.title} · {formatDate(o.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge kind="order" status={o.status} />
                          {o.subsidy ? <StatusBadge kind="subsidy" status={o.subsidy} /> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(o.totalPaise)}
                        {o.totalPaise > o.paidPaise && o.status !== "cancelled" ? <p className="text-xs text-warning-foreground">{formatINR(o.totalPaise - o.paidPaise)} due</p> : null}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {o.workmanship ? (
                          <span className={o.workmanship.state === "in_warranty" ? "text-success-foreground" : "text-danger-foreground"}>{o.workmanship.label}</span>
                        ) : (
                          <span className="text-muted-foreground">{o.jobId ? "After commissioning" : "No installation"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Serial numbers and warranty" description="Each unit's clock started on delivery; dates are never typed." contentClassName="p-0">
            {data.units.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing delivered yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead className="hidden sm:table-cell">Order</TableHead>
                    <TableHead>Warranty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.units.map((u) => (
                    <TableRow key={u.id} className={u.status === "replaced" ? "opacity-60" : undefined}>
                      <TableCell>
                        <p className="font-mono text-xs">{u.serial}</p>
                        <p className="text-xs text-muted-foreground">
                          {PRODUCT_CATEGORY_LABELS[u.category]} · {u.productName}
                        </p>
                        {u.replacesSerial ? <p className="text-xs text-muted-foreground">Replaced {u.replacesSerial}</p> : null}
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">
                        {u.orderNumber ?? "—"}
                        {u.deliveredAt ? <p className="text-xs text-muted-foreground">Delivered {formatDate(u.deliveredAt)}</p> : null}
                      </TableCell>
                      <TableCell>
                        {u.status === "replaced" ? (
                          <Badge variant="neutral">Replaced by {u.replacedBySerial ?? "a new unit"}</Badge>
                        ) : (
                          <>
                            <StatusBadge kind="warranty" status={u.warranty.state} />
                            <p className="mt-1 text-xs text-muted-foreground">{u.warranty.endsAt ? `${u.warranty.label} · ${formatDate(u.warranty.endsAt)}` : "Starts on delivery"}</p>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Tickets" contentClassName="p-0">
            {data.tickets.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No service tickets.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <MaybeLink href={`/service/${t.id}`} show={can("ticket")}>
                          {t.number}
                        </MaybeLink>
                        <p className="text-xs text-muted-foreground">
                          {TICKET_CATEGORY_LABELS[t.category]}
                          {t.serial ? ` · ${t.serial}` : " · no serial"} · {formatDate(t.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="ticket" status={t.status} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{t.billable ? <Badge variant="warning">Billable</Badge> : <Badge variant="success">₹0 · warranty</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Invoices and payments" contentClassName="p-0">
            {data.invoices.length === 0 && data.payments.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing invoiced or received yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <MaybeLink href={`/invoices/${i.id}`} show={can("invoice")} className="font-mono text-xs">
                          {i.number}
                        </MaybeLink>
                        <p className="text-xs text-muted-foreground">{i.type === "sale" ? "Sale invoice" : "Service invoice"}</p>
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">{formatDate(i.issuedAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(i.totalPaise)}
                        <div className="mt-1 flex justify-end">
                          <StatusBadge kind="invoice" status={i.status} />
                        </div>
                        {i.overdue ? <p className="text-xs text-danger-foreground">Overdue</p> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-mono text-xs">{p.number}</span>
                        <p className="text-xs text-muted-foreground">
                          Payment · {PAYMENT_MODE_LABELS[p.mode]}
                          {p.orderNumber ? ` · ${p.orderNumber}` : ""}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">{formatDate(p.receivedAt)}</TableCell>
                      <TableCell className="text-right tabular-nums text-success-foreground">+{formatINR(p.amountPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Contact and site">
            <DetailList
              columns={1}
              items={[
                { label: "Mobile", value: formatPhone(customer.phone) },
                ...(customer.email ? [{ label: "Email", value: customer.email }] : []),
                { label: "Address", value: <span className="ph-no-capture">{[customer.address.line1, customer.address.city, customer.address.pincode].filter(Boolean).join(", ")}</span> },
                ...(customer.discom ? [{ label: "DISCOM", value: customer.discom }] : []),
                ...(customer.consumerNumber ? [{ label: "Service connection", value: <span className="ph-no-capture">{customer.consumerNumber}</span> }] : []),
                ...(customer.gstin ? [{ label: "GSTIN", value: <span className="font-mono">{customer.gstin}</span> }] : []),
              ]}
            />
          </Section>

          <Section title="Enquiries and quotes">
            {data.leads.length === 0 && data.quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {data.leads.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-2">
                    <div>
                      <MaybeLink href={`/leads/${l.id}`} show={can("lead")} className="font-mono text-xs">
                        {l.number}
                      </MaybeLink>
                      <p className="text-xs text-muted-foreground">
                        {LEAD_SOURCE_LABELS[l.source]} · {l.capacityKw} kW · {formatDate(l.createdAt)}
                      </p>
                    </div>
                    <StatusBadge kind="lead" status={l.status} />
                  </li>
                ))}
                {data.quotes.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-2">
                    <div>
                      <MaybeLink href={`/quotes/${q.id}`} show={can("quote")} className="font-mono text-xs">
                        {q.number} v{q.version}
                      </MaybeLink>
                      <p className="text-xs text-muted-foreground">
                        {q.capacityKw} kW {SYSTEM_TYPE_LABELS[q.systemType]} · {formatINR(q.totalPaise)}
                      </p>
                    </div>
                    <StatusBadge kind="quote" status={q.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Activity">
            <Timeline items={activity.map((a) => ({ id: a.id, title: a.title, at: a.at, actor: a.actor }))} />
          </Section>
        </aside>
      </div>
    </>
  );
}
