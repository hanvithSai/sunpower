/**
 * Printable A4 quotation. The app chrome is hidden by the print stylesheet, so
 * "Print → Save as PDF" produces a clean document to send the customer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { QuoteLines } from "@/components/modules/quotes/quote-lines";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { COMPANY, PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/lib/constants";
import { formatDate, formatPhone } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getQuoteDetail } from "@/server/services/quotes";

export const metadata: Metadata = { title: "Quotation" };

function warrantyLine(months: number): string {
  if (months >= 12) return `${months / 12} year${months === 12 ? "" : "s"}`;
  return `${months} months`;
}

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["sales"]);
  const { id } = await params;
  const detail = await getQuoteDetail(id);
  if (!detail) notFound();
  const { quote, customer } = detail;

  // One warranty row per product category that carries a warranty.
  const warranties = new Map<ProductCategory, number>();
  for (const line of quote.lines) {
    if (line.warrantyMonths > 0) warranties.set(line.category, Math.max(warranties.get(line.category) ?? 0, line.warrantyMonths));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between" data-print-hide>
        <Button asChild variant="ghost">
          <Link href={`/quotes/${quote.id}`}>
            <ArrowLeft aria-hidden="true" />
            Back to quote
          </Link>
        </Button>
        <PrintButton label="Print / Save as PDF" />
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
            <h1 className="text-2xl font-semibold tracking-tight">Quotation</h1>
            <p className="mt-1 font-mono">
              {quote.number} · v{quote.version}
            </p>
            <p className="text-muted-foreground">Date {formatDate(quote.createdAt)}</p>
            <p className="text-muted-foreground">Valid until {formatDate(quote.validUntil)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">Prepared for</p>
            <p className="mt-1 font-semibold">{customer?.name}</p>
            {customer ? (
              <p className="text-muted-foreground">
                {[customer.address.line1, customer.address.city, `${customer.address.state} ${customer.address.pincode}`].filter(Boolean).join(", ")}
                <br />
                {formatPhone(customer.phone)}
                {customer.gstin ? (
                  <>
                    <br />
                    GSTIN {customer.gstin}
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium font-sans tracking-normal text-muted-foreground">System</p>
            <p className="mt-1 font-semibold">{quote.title}</p>
            <p className="text-muted-foreground">
              Supply, installation, testing and commissioning on your rooftop, including all mounting, cabling, protection and earthing.
            </p>
          </div>
        </section>

        <QuoteLines lines={quote.lines} totals={quote} showHsn />

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold">Warranty</h2>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {[...warranties.entries()].map(([category, months]) => (
                <li key={category}>
                  {PRODUCT_CATEGORY_LABELS[category]}: {warrantyLine(months)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Every panel, inverter and battery is registered by serial number to your address on delivery; warranty starts that day.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Terms</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>50% advance to confirm the order; balance on installation.</li>
              <li>Installation within 7 working days of the advance.</li>
              {quote.subsidyPaise ? (
                <li>
                  The PM Surya Ghar subsidy is credited by the government to your bank account after DISCOM inspection — we file and track
                  the application for you.
                </li>
              ) : null}
              <li>Prices include GST as shown. Valid until {formatDate(quote.validUntil)}.</li>
            </ul>
          </div>
        </section>

        {quote.notes ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold">Notes</h2>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">{quote.notes}</p>
          </section>
        ) : null}

        <footer className="mt-12 grid grid-cols-2 gap-12">
          <div className="border-t border-border pt-2 text-xs text-muted-foreground">For {COMPANY.name}</div>
          <div className="border-t border-border pt-2 text-right text-xs text-muted-foreground">Customer acceptance</div>
        </footer>
      </article>
    </div>
  );
}
