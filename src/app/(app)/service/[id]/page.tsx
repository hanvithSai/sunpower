/**
 * One service ticket from complaint to the customer's confirmation: warranty
 * card, the unit and its history, the visit, the resolution (parts, labour,
 * replacement, invoice or the cost we absorbed), and the next action for the
 * ticket's status. Support books, resolves, confirms and closes; the assigned
 * technician starts and resolves on site.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCheck, MessageCircle, Phone, Play } from "lucide-react";
import { AssignTicketDialog, BillingOverrideDialog, ConfirmTicketDialog, ReopenTicketDialog, ResolveTicketForm } from "@/components/modules/service/ticket-forms";
import { WarrantyCard } from "@/components/modules/service/warranty-card";
import { ActionButton } from "@/components/shared/action-button";
import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { CONFIRMATION_CHANNEL_LABELS, RESOLUTION_TYPE_LABELS, TICKET_CATEGORY_LABELS, TICKET_CHANNEL_LABELS } from "@/lib/constants";
import { addHours } from "@/lib/dates";
import { formatDate, formatDateTime, formatPhone, formatRelative, telLink, toDateTimeInputValue, waLink } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { closeTicketAction, startTicketAction } from "@/server/actions/service";
import { requireUser } from "@/server/auth/session";
import { listActivity } from "@/server/services/core/activity";
import { getTicketDetail } from "@/server/services/tickets";
import { listStaff } from "@/server/services/users";

export const metadata: Metadata = { title: "Service ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["support", "technician"]);
  const { id } = await params;
  const now = new Date();
  const detail = await getTicketDetail(id, now);
  if (!detail) notFound();
  const { ticket, customer, order, unit, job, invoice, parts, replacements } = detail;

  const desk = user.role === "support" || user.role === "admin";
  const assignedToMe = ticket.assignedTo?.id === user.id;
  if (user.role === "technician" && !assignedToMe) notFound();
  const working = ["open", "assigned", "in_progress"].includes(ticket.status);
  const canResolve = working && (desk || assignedToMe);
  const [activity, technicians] = await Promise.all([listActivity("ticket", ticket.id), desk && working ? listStaff({ roles: ["technician"] }) : Promise.resolve([])]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${ticket.number} · ${customer?.name ?? ""}`}
        breadcrumbs={[{ label: "Service", href: "/service" }, { label: ticket.number }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="ticket" status={ticket.status} />
            <StatusBadge kind="priority" status={ticket.priority} />
            <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span>
            {working ? (
              <span className={ticket.overdue ? "font-medium text-danger-foreground" : ""}>
                {ticket.overdue ? "Overdue" : "Due"} {formatRelative(ticket.slaDueAt, now)}
              </span>
            ) : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {desk && working ? (
              <AssignTicketDialog
                ticketId={ticket.id}
                technicians={technicians}
                defaultTechnicianId={ticket.assignedTo?.id}
                defaultVisitAt={toDateTimeInputValue(job?.scheduledFor ?? addHours(now, 2))}
                minVisitAt={toDateTimeInputValue(now).slice(0, 10) + "T00:00"}
                rebook={Boolean(ticket.assignedTo)}
              />
            ) : null}
            {ticket.status === "assigned" && (desk || assignedToMe) ? (
              <ActionButton action={startTicketAction} hiddenFields={{ ticketId: ticket.id }}>
                <Play aria-hidden="true" />
                Start work
              </ActionButton>
            ) : null}
            {ticket.status === "resolved" && desk ? <ConfirmTicketDialog ticketId={ticket.id} customerName={customer?.name ?? ""} /> : null}
            {ticket.status === "customer_confirmed" && desk ? (
              <ActionButton action={closeTicketAction} hiddenFields={{ ticketId: ticket.id }}>
                <CheckCheck aria-hidden="true" />
                Close ticket
              </ActionButton>
            ) : null}
            {["resolved", "customer_confirmed", "closed"].includes(ticket.status) && (desk || assignedToMe) ? <ReopenTicketDialog ticketId={ticket.id} /> : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-2">
            <WarrantyCard
              state={ticket.warranty.state}
              basis={ticket.warranty.basis}
              endsAt={ticket.warranty.endsAt}
              daysLeft={ticket.warrantyInfo.daysLeft}
              billable={ticket.billable}
              serial={ticket.serial}
              productName={ticket.productName}
              overrideReason={ticket.billingOverride?.reason}
            />
            {desk && working ? (
              <div className="flex justify-end">
                <BillingOverrideDialog ticketId={ticket.id} billable={ticket.billable} />
              </div>
            ) : null}
          </div>

          <Section title="Complaint">
            <p className="text-sm text-foreground">{ticket.description}</p>
            <DetailList
              items={[
                ...(ticket.faultCode ? [{ label: "Fault code", value: <span className="font-mono">{ticket.faultCode}</span> }] : []),
                { label: "Came in by", value: TICKET_CHANNEL_LABELS[ticket.channel] },
                { label: "Raised", value: `${formatDateTime(ticket.createdAt)} by ${ticket.createdBy}` },
                ...(ticket.reopenCount ? [{ label: "Reopened", value: `${ticket.reopenCount}×` }] : []),
              ]}
            />
          </Section>

          {canResolve ? (
            <Section title="Resolve" description={ticket.status === "open" ? "Fixed over the phone? Resolve it directly. Otherwise book a visit first." : undefined}>
              <ResolveTicketForm ticketId={ticket.id} billable={ticket.billable} hasSerial={Boolean(ticket.serial)} parts={parts} replacements={replacements} />
            </Section>
          ) : null}

          {ticket.resolution ? (
            <Section title="Resolution">
              <DetailList
                items={[
                  { label: "Outcome", value: RESOLUTION_TYPE_LABELS[ticket.resolution.type] },
                  { label: "By", value: `${ticket.resolution.resolvedBy.name}, ${formatDateTime(ticket.resolution.resolvedAt)}` },
                  { label: "Labour", value: `${ticket.resolution.labourHours} h` },
                  ...(ticket.resolution.replacementSerial ? [{ label: "Replacement unit", value: <span className="font-mono">{ticket.resolution.replacementSerial}</span> }] : []),
                  ...(ticket.resolution.partsUsed.length ? [{ label: "Parts", value: ticket.resolution.partsUsed.map((p) => `${p.qty} × ${p.name}`).join(", ") }] : []),
                  invoice
                    ? { label: "Billed", value: <Link className="text-primary hover:underline" href={`/invoices/${invoice.id}`}>{`${invoice.number} · ${formatINR(invoice.totalPaise)}`}</Link> }
                    : { label: "Customer paid", value: `₹0${ticket.serviceCostPaise ? ` · we absorbed ${formatINR(ticket.serviceCostPaise)} (charged to ${order?.number ?? "the installation"})` : ""}` },
                ]}
              />
              <p className="mt-3 text-sm text-foreground">{ticket.resolution.notes}</p>
              {ticket.confirmation ? (
                <p className="mt-3 rounded-xl bg-success/12 px-3 py-2 text-sm text-success-foreground">
                  Confirmed working by {ticket.confirmation.confirmedBy} ({CONFIRMATION_CHANNEL_LABELS[ticket.confirmation.channel].toLowerCase()}), {formatDateTime(ticket.confirmation.at)}
                  {ticket.confirmation.note ? ` — ${ticket.confirmation.note}` : ""}
                </p>
              ) : ticket.status === "resolved" ? (
                <p className="mt-3 rounded-xl bg-warning/12 px-3 py-2 text-sm text-warning-foreground">Waiting for the customer to confirm everything works before this can close.</p>
              ) : null}
            </Section>
          ) : null}

          <Section title="Activity">
            <Timeline items={activity.map((a) => ({ id: a.id, title: a.title, at: a.at, actor: a.actor }))} />
          </Section>
        </div>

        <aside className="space-y-6">
          {customer ? (
            <Section title="Customer">
              <div className="space-y-3 text-sm">
                {user.role === "technician" ? (
                  <p className="font-medium">{customer.name}</p>
                ) : (
                  <Link href={`/customers/${customer.id}`} className="font-medium text-foreground hover:text-primary">
                    {customer.name}
                  </Link>
                )}
                <p className="ph-no-capture text-muted-foreground">{[customer.address.line1, customer.address.city, customer.address.pincode].filter(Boolean).join(", ")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <a href={telLink(customer.phone)}>
                      <Phone aria-hidden="true" />
                      Call
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={waLink(customer.phone, `Hello ${customer.name}, this is SunPower about ticket ${ticket.number}.`)} target="_blank" rel="noreferrer">
                      <MessageCircle aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPhone(customer.phone)}
                  {order ? (
                    <>
                      {" · "}
                      {desk ? (
                        <Link href={`/orders/${order.id}`} className="text-primary underline underline-offset-2">
                          {order.number}
                        </Link>
                      ) : (
                        order.number
                      )}
                    </>
                  ) : null}
                </p>
              </div>
            </Section>
          ) : null}

          <Section title="Visit">
            {job ? (
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{job.number}</span>
                  <StatusBadge kind="job" status={job.status} />
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                  {formatDateTime(job.scheduledFor)}
                </p>
                <p className="text-muted-foreground">{ticket.assignedTo?.name}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No visit booked yet.</p>
            )}
          </Section>

          {unit ? (
            <Section title="Unit history" description={`${unit.productName} · ${unit.serial}`}>
              <ol className="space-y-2 text-xs">
                {[...unit.history].reverse().map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <StatusBadge kind="serial" status={h.status} />
                    <span className="min-w-0">
                      <span className="block text-foreground">{h.note ?? ""}</span>
                      <span className="block text-muted-foreground">
                        {formatDate(h.at)}
                        {h.by ? ` · ${h.by}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {unit.replacedBySerial ? <p className="mt-3 text-xs text-muted-foreground">Replaced by <span className="font-mono">{unit.replacedBySerial}</span></p> : null}
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
