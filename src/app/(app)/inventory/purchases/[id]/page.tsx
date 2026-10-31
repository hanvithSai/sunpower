/**
 * One goods receipt: the supplier invoice, each line at its unit cost and the
 * serial numbers it registered.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { Section } from "@/components/shared/section";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR, formatNumber } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getPurchase } from "@/server/services/inventory";

export const metadata: Metadata = { title: "Goods receipt" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["warehouse"]);
  const { id } = await params;
  const grn = await getPurchase(id);
  if (!grn) notFound();

  return (
    <>
      <PageHeader
        title={`${grn.number} · ${grn.supplier.name}`}
        description={`Received ${formatDateTime(grn.receivedAt)} by ${grn.receivedBy}`}
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Goods receipts", href: "/inventory/purchases" },
          { label: grn.number },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-4 lg:col-span-2">
          {grn.lines.map((line) => (
            <Section
              key={line.productId}
              title={line.name}
              description={
                <span className="tabular-nums">
                  <span className="font-mono">{line.sku}</span> · {formatNumber(line.qty)} × {formatINR(line.unitCostPaise)} = {formatINR(line.qty * line.unitCostPaise)}
                </span>
              }
            >
              {line.serials.length ? (
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Serials for ${line.name}`}>
                  {line.serials.map((s) => (
                    <li key={s} className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Bulk item — counted, not serial-tracked.</p>
              )}
            </Section>
          ))}
        </div>
        <aside>
          <Section title="Supplier invoice">
            <DetailList
              columns={1}
              items={[
                { label: "Supplier", value: grn.supplier.name },
                ...(grn.supplier.gstin ? [{ label: "GSTIN", value: <span className="font-mono">{grn.supplier.gstin}</span> }] : []),
                { label: "Invoice", value: `${grn.invoiceNo} · ${formatDate(grn.invoiceDate)}` },
                { label: "Units", value: formatNumber(grn.lines.reduce((n, l) => n + l.qty, 0)) },
                { label: "Serials registered", value: formatNumber(grn.lines.reduce((n, l) => n + l.serials.length, 0)) },
                { label: "Value at cost", value: formatINR(grn.totalPaise) },
                ...(grn.notes ? [{ label: "Notes", value: grn.notes }] : []),
              ]}
            />
          </Section>
        </aside>
      </div>
    </>
  );
}
