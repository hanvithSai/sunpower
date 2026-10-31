/**
 * One GST tax invoice, laid out as the A4 document itself ("Print → Save as
 * PDF" gives a clean copy): supplier and customer GSTIN, place of supply,
 * HSN/SAC per line, the CGST/SGST split by rate and the amount in words.
 * Payments and actions sit outside the printed area.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RecordPaymentDialog } from "@/components/modules/orders/record-payment-dialog";
import { PrintButton } from "@/components/shared/print-button";
import { Section } from "@/components/shared/section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { COMPANY, PAYMENT_MODE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/format";
import { gstBreakup } from "@/lib/gst";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getInvoiceDetail } from "@/server/services/finance";

export const metadata: Metadata = { title: "Tax invoice" };

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r]! : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}

/** Indian system: 2,24,200 → "Two Lakh Twenty Four Thousand Two Hundred". */
function rupeesInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return `Rupees ${parts.join(" ") || "Zero"}${p ? ` and ${below1000(p)} Paise` : ""} only`;
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["sales", "support"]);
  const { id } = await params;
  const now = new Date();
  const detail = await getInvoiceDetail(id);
  if (!detail) notFound();
  const { invoice, order, ticket, customerGstin, payments } = detail;
  const breakup = gstBreakup(invoice.lines);
  const canTakePayment = invoice.duePaise > 0 && invoice.status !== "void" && (user.role === "admin" || user.role === "sales" || (user.role === "support" && invoice.type === "service"));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2" data-print-hide>
        <Button asChild variant="ghost">
          <Link href="/invoices">
            <ArrowLeft aria-hidden="true" />
            Invoices
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="invoice" status={invoice.status} />
          {canTakePayment ? (
            // Sale invoices are paid through their order (keeps both in step); service invoices directly.
            <RecordPaymentDialog
              orderId={invoice.type === "sale" ? order?.id : undefined}
              invoiceId={invoice.type === "sale" ? undefined : invoice.id}
              ticketId={ticket?.id}
              outstandingPaise={invoice.duePaise}
              today={toDateInputValue(now)}
              defaultType={invoice.type === "sale" ? "balance" : "service"}
            />
          ) : null}
          <PrintButton label="Print / Save as PDF" />
        </div>
      </div>

      <article className="rounded-2xl border border-border bg-white p-8 text-[13px] text-foreground shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              {COMPANY.name}
              <br />
              {COMPANY.address}
              <br />
              GSTIN {COMPANY.gstin} · {COMPANY.phone}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-semibold tracking-tight">Tax Invoice</h1>
            <p className="mt-1 font-mono text-sm">{invoice.number}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Date {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueAt)}
            </p>
            <p className="text-xs text-muted-foreground">Place of supply: {COMPANY.state} ({COMPANY.stateCode})</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-border py-5 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</h2>
            <p className="font-medium">{invoice.billTo.name}</p>
            <p className="text-muted-foreground">{invoice.billTo.address}</p>
            <p className="text-muted-foreground">{invoice.billTo.phone}</p>
            {invoice.billTo.gstin || customerGstin ? <p className="text-muted-foreground">GSTIN {invoice.billTo.gstin ?? customerGstin}</p> : null}
          </div>
          <div className="sm:text-right">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</h2>
            {order ? <p>Order {order.number} · {order.title}</p> : null}
            {ticket ? <p>Service ticket {ticket.number}</p> : null}
            {invoice.notes ? <p className="text-muted-foreground">{invoice.notes}</p> : null}
          </div>
        </section>

        <table className="mt-5 w-full text-left">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 font-medium">#</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">HSN/SAC</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">GST</th>
              <th className="py-2 text-right font-medium">Taxable</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-border/60 align-top">
                <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 pr-2 font-mono text-xs">{l.hsn}</td>
                <td className="py-2 text-right tabular-nums">{l.qty}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(l.unitPricePaise, { exact: true })}</td>
                <td className="py-2 text-right tabular-nums">{l.gstRate}%</td>
                <td className="py-2 text-right tabular-nums">{formatINR(l.taxablePaise, { exact: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-5 grid gap-6 sm:grid-cols-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-medium">GST rate</th>
                <th className="py-1 text-right font-medium">Taxable</th>
                <th className="py-1 text-right font-medium">CGST</th>
                <th className="py-1 text-right font-medium">SGST</th>
              </tr>
            </thead>
            <tbody>
              {breakup.map((b) => (
                <tr key={b.rate} className="border-t border-border/60">
                  <td className="py-1">{b.rate}%</td>
                  <td className="py-1 text-right tabular-nums">{formatINR(b.taxablePaise, { exact: true })}</td>
                  <td className="py-1 text-right tabular-nums">{formatINR(Math.round(b.gstPaise / 2), { exact: true })}</td>
                  <td className="py-1 text-right tabular-nums">{formatINR(b.gstPaise - Math.round(b.gstPaise / 2), { exact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxable value</dt>
              <dd className="tabular-nums">{formatINR(invoice.taxablePaise, { exact: true })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">CGST</dt>
              <dd className="tabular-nums">{formatINR(invoice.cgstPaise, { exact: true })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">SGST</dt>
              <dd className="tabular-nums">{formatINR(invoice.sgstPaise, { exact: true })}</dd>
            </div>
            {invoice.igstPaise ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IGST</dt>
                <dd className="tabular-nums">{formatINR(invoice.igstPaise, { exact: true })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatINR(invoice.totalPaise, { exact: true })}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Received</dt>
              <dd className="tabular-nums">{formatINR(invoice.paidPaise, { exact: true })}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{formatINR(invoice.duePaise, { exact: true })}</dd>
            </div>
          </dl>
        </section>
        <p className="mt-4 text-xs text-muted-foreground">Amount in words: {rupeesInWords(invoice.totalPaise)}</p>
        <p className="mt-6 text-right text-xs text-muted-foreground">For {COMPANY.name} — computer-generated invoice</p>
      </article>

      <div className="mt-6" data-print-hide>
        <Section title="Payments received">
          {payments.length ? (
            <ul className="divide-y divide-border text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono text-xs">{p.number}</span> · {PAYMENT_MODE_LABELS[p.mode]}
                    {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                  </span>
                  <span className="tabular-nums">
                    {formatINR(p.amountPaise)} <span className="text-xs text-muted-foreground">{formatDateTime(p.receivedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
