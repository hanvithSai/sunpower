/**
 * One quote: the full bill of materials with GST and subsidy, plus the sales
 * actions — share on WhatsApp, mark sent, customer accepted (creates the
 * order), declined, revise, print.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle, Pencil, Printer, Send, ShoppingCart } from "lucide-react";
import { DeclineQuoteDialog } from "@/components/modules/quotes/decline-quote-dialog";
import { QuoteLines } from "@/components/modules/quotes/quote-lines";
import { ActionButton } from "@/components/shared/action-button";
import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { CUSTOMER_TYPE_LABELS, PRODUCT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone, waLink } from "@/lib/format";
import { formatINR, formatPercent } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { acceptQuoteAction, markQuoteSentAction } from "@/server/actions/quotes";
import { listActivity } from "@/server/services/core/activity";
import { getQuoteDetail } from "@/server/services/quotes";
import { Timeline } from "@/components/shared/timeline";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["sales"]);
  const { id } = await params;
  const now = new Date();
  const detail = await getQuoteDetail(id);
  if (!detail) notFound();
  const { quote, lead, customer, order } = detail;
  const activity = await listActivity("quote", quote.id);

  const missingText = quote.missing.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()).join(", ");
  const open = quote.status === "draft" || quote.status === "sent";
  const expired = open && new Date(quote.validUntil) < now;
  const shareText = `Namaste ${(customer?.name ?? lead?.name ?? "").split(" ")[0]} garu! Your SunPower quotation ${quote.number} for a ${quote.title}: ${formatINR(quote.totalPaise)} incl. GST${quote.subsidyPaise ? `, about ${formatINR(quote.netCostPaise)} after the PM Surya Ghar subsidy` : ""}. Valid till ${formatDate(quote.validUntil)}.`;

  return (
    <>
      <PageHeader
        title={`${quote.number} · ${quote.title}`}
        breadcrumbs={[{ label: "Quotes", href: "/quotes" }, { label: `${quote.number} v${quote.version}` }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {expired ? <StatusBadge kind="quote" status="expired" /> : <StatusBadge kind="quote" status={quote.status} />}
            <span>
              For {customer?.name ?? lead?.name} · created {formatDate(quote.createdAt)} by {quote.createdBy}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {customer && open ? (
              <Button asChild variant="outline">
                <a href={waLink(customer.phone, shareText)} target="_blank" rel="noreferrer">
                  <MessageCircle aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/quotes/${quote.id}/print`}>
                <Printer aria-hidden="true" />
                Print
              </Link>
            </Button>
            {quote.status === "draft" ? (
              <ActionButton
                action={markQuoteSentAction}
                variant="outline"
                // R-24: a gap in the parts list needs an explicit OK, which the timeline records.
                hiddenFields={missingText ? { quoteId: quote.id, sendWithMissing: "on" } : { quoteId: quote.id }}
                confirm={
                  missingText
                    ? { title: "Send without the missing parts?", description: `This quote has no ${missingText}. Revise it to add them, or send it as it is.`, confirmText: "Send anyway" }
                    : undefined
                }
              >
                <Send aria-hidden="true" />
                Mark sent
              </ActionButton>
            ) : null}
            {open && lead ? (
              <Button asChild variant="outline">
                <Link href={`/quotes/new?leadId=${lead.id}&from=${quote.id}`}>
                  <Pencil aria-hidden="true" />
                  Revise
                </Link>
              </Button>
            ) : null}
            {open && !expired ? <DeclineQuoteDialog quoteId={quote.id} /> : null}
            {open && !expired ? (
              <ActionButton
                action={acceptQuoteAction}
                hiddenFields={{ quoteId: quote.id }}
                confirm={{
                  title: "Customer accepted this quote?",
                  description: `This creates the order for ${formatINR(quote.totalPaise)}. The first payment confirms it and books the installation.`,
                  confirmText: "Create order",
                }}
              >
                <CheckCircle2 aria-hidden="true" />
                Customer accepted
              </ActionButton>
            ) : null}
            {order ? (
              <Button asChild>
                <Link href={`/orders/${order.id}`}>
                  <ShoppingCart aria-hidden="true" />
                  Order {order.number}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {expired ? (
        <p className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
          This quote expired on {formatDate(quote.validUntil)}. Revise it to send updated prices.
        </p>
      ) : null}
      {missingText && open ? (
        <p className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
          This {quote.title.replace(/ system$/, "")} quote has no {missingText}. Revise it to add {quote.missing.length === 1 ? "it" : "them"} before the customer accepts.
        </p>
      ) : null}
      {quote.rejectedReason ? (
        <p className="mb-6 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Declined: {quote.rejectedReason}</p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total incl. GST" value={formatINR(quote.totalPaise)} hint={`${formatINR(quote.gstPaise)} GST`} />
        <StatCard
          label="After subsidy"
          value={formatINR(quote.netCostPaise)}
          hint={quote.subsidyPaise ? `${formatINR(quote.subsidyPaise)} PM Surya Ghar` : "Not eligible"}
          tone={quote.subsidyPaise ? "success" : "neutral"}
        />
        <StatCard label="Valid until" value={formatDate(quote.validUntil)} hint={quote.sentAt ? `Sent ${formatDateTime(quote.sentAt)}` : "Not sent yet"} />
        <StatCard
          label="Margin (internal)"
          value={formatPercent(quote.marginPaise, quote.taxablePaise)}
          hint={`${formatINR(quote.marginPaise)} before labour`}
          tone={quote.marginPaise / Math.max(1, quote.taxablePaise) < 0.15 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Bill of materials" contentClassName="p-0">
            <QuoteLines lines={quote.lines} totals={quote} />
          </Section>
          {quote.notes ? (
            <Section title="Notes">
              <p className="whitespace-pre-line text-sm text-foreground">{quote.notes}</p>
            </Section>
          ) : null}
          <Section title="Activity">
            <Timeline items={activity.map((a) => ({ id: a.id, title: a.title, at: a.at, actor: a.actor }))} />
          </Section>
        </div>
        <aside className="space-y-6">
          {customer ? (
            <Section title="Customer">
              <DetailList
                columns={1}
                items={[
                  { label: "Name", value: customer.name },
                  { label: "Phone", value: formatPhone(customer.phone) },
                  { label: "Type", value: CUSTOMER_TYPE_LABELS[customer.type] },
                  { label: "Site", value: [customer.address.line1, customer.address.city, customer.address.pincode].filter(Boolean).join(", ") },
                  ...(lead
                    ? [
                        {
                          label: "Lead",
                          value: (
                            <Link href={`/leads/${lead.id}`} className="text-primary hover:underline">
                              {lead.number}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
