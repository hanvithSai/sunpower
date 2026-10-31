"use client";

/**
 * Goods receipt (GRN) form. Each line is a product, quantity and unit cost;
 * serial-tracked lines also take one serial per unit — scanned with the camera
 * straight off the boxes, typed, or pasted from the supplier's packing list.
 * The counter turns green when serials match the quantity. Posts JSON to
 * receiveGoodsAction; the server re-checks everything (BR-12, BR-13).
 */
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck, Plus, ScanLine, Trash2, X } from "lucide-react";
import { BarcodeScanner } from "@/components/shared/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { splitSerials } from "@/lib/validation/inventory";
import { receiveGoodsAction } from "@/server/actions/inventory";

export type ReceivableProduct = {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  isSerialized: boolean;
  costPaise: number;
  stockQty: number;
};

type Line = { key: number; productId: string; qty: number; unitCostRs: number; serialsText: string };

let nextKey = 1;

export function GrnForm({ products, today }: { products: ReceivableProduct[]; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [scanningKey, setScanningKey] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalPaise = lines.reduce((sum, l) => sum + Math.round(l.qty * l.unitCostRs * 100), 0);

  function addLine() {
    const product = productsById.get(addProductId);
    if (!product) return;
    setLines((current) => [...current, { key: nextKey++, productId: product.id, qty: product.isSerialized ? 0 : 1, unitCostRs: product.costPaise / 100, serialsText: "" }]);
    setAddProductId("");
  }

  function update(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** A scan appends one serial (ignoring repeats) and keeps the quantity in step. */
  function addScanned(key: number, text: string) {
    setLines((current) =>
      current.map((l) => {
        if (l.key !== key) return l;
        const serials = splitSerials(l.serialsText);
        const serial = splitSerials(text)[0];
        if (!serial || serials.includes(serial)) return l;
        const next = [...serials, serial];
        return { ...l, serialsText: next.join("\n"), qty: Math.max(l.qty, next.length) };
      }),
    );
  }

  function submit() {
    setErrors({});
    if (!supplierName.trim() || !invoiceNo.trim()) {
      setErrors({ supplierName: supplierName.trim() ? "" : "Supplier is required", invoiceNo: invoiceNo.trim() ? "" : "Invoice number is required" });
      toast.error("Add the supplier and their invoice number.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    startTransition(async () => {
      const result = await receiveGoodsAction({
        supplierName,
        supplierGstin: supplierGstin || undefined,
        invoiceNo,
        invoiceDate,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitCostRs: l.unitCostRs,
          serials: productsById.get(l.productId)?.isSerialized ? splitSerials(l.serialsText) : [],
        })),
      });
      if (result?.ok) {
        toast.success(result.message ?? "Goods received");
        const id = result.data?.purchaseId;
        router.push(typeof id === "string" ? `/inventory/purchases/${id}` : "/inventory/purchases");
        return;
      }
      setErrors(result?.fieldErrors ?? {});
      toast.error(result?.message ?? "Couldn't save the goods receipt.");
    });
  }

  const serialized = products.filter((p) => p.isSerialized);
  const bulk = products.filter((p) => !p.isSerialized);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section aria-labelledby="supplier-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="supplier-heading" className="text-base font-semibold text-foreground">
            1. Supplier invoice
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" id="supplierName" error={errors.supplierName} required>
              <Input id="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} maxLength={120} placeholder="e.g. Waaree Energies Ltd" />
            </Field>
            <Field label="Supplier GSTIN" id="supplierGstin" error={errors.supplierGstin}>
              <Input id="supplierGstin" value={supplierGstin} onChange={(e) => setSupplierGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="15 characters" className="font-mono" />
            </Field>
            <Field label="Invoice number" id="invoiceNo" error={errors.invoiceNo} required>
              <Input id="invoiceNo" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} maxLength={40} />
            </Field>
            <Field label="Invoice date" id="invoiceDate" error={errors.invoiceDate} required>
              <Input id="invoiceDate" type="date" max={today} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </Field>
          </div>
        </section>

        <section aria-labelledby="lines-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="lines-heading" className="text-base font-semibold text-foreground">
            2. Items received
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Serial-tracked items need one serial per unit: scan the boxes, type, or paste a list.</p>

          <div className="mt-4 space-y-4">
            {lines.map((line, index) => {
              const product = productsById.get(line.productId)!;
              const serials = product.isSerialized ? splitSerials(line.serialsText) : [];
              const matched = product.isSerialized && serials.length === line.qty && line.qty > 0;
              const serialError = errors[`lines.${index}.serials`];
              return (
                <div key={line.key} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{product.sku}</span> · {PRODUCT_CATEGORY_LABELS[product.category]} · {product.stockQty} on hand
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${product.name}`} onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
                    <Field label={`Quantity (${product.unit})`} id={`qty-${line.key}`} error={errors[`lines.${index}.qty`]}>
                      <Input
                        id={`qty-${line.key}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={line.qty || ""}
                        onChange={(e) => update(line.key, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      />
                    </Field>
                    <Field label="Unit cost (₹)" id={`cost-${line.key}`} error={errors[`lines.${index}.unitCostRs`]}>
                      <Input
                        id={`cost-${line.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={line.unitCostRs}
                        onChange={(e) => update(line.key, { unitCostRs: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </Field>
                  </div>

                  {product.isSerialized ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor={`serials-${line.key}`}>Serial numbers</Label>
                        <span
                          className={cn("text-xs font-medium tabular-nums", matched ? "text-success-foreground" : "text-warning-foreground")}
                          aria-live="polite"
                        >
                          {serials.length} of {line.qty || 0} entered
                        </span>
                      </div>
                      <Textarea
                        id={`serials-${line.key}`}
                        rows={3}
                        value={line.serialsText}
                        onChange={(e) => update(line.key, { serialsText: e.target.value })}
                        placeholder="One per line, or separated by commas"
                        className="font-mono text-sm"
                        aria-invalid={serialError ? true : undefined}
                      />
                      {serialError ? (
                        <p role="alert" className="text-sm text-danger-foreground">
                          {serialError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setScanningKey(scanningKey === line.key ? null : line.key)}>
                          {scanningKey === line.key ? <X aria-hidden="true" /> : <ScanLine aria-hidden="true" />}
                          {scanningKey === line.key ? "Close scanner" : "Scan boxes"}
                        </Button>
                        {serials.length > 0 && serials.length !== line.qty ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => update(line.key, { qty: serials.length })}>
                            Set quantity to {serials.length}
                          </Button>
                        ) : null}
                      </div>
                      {scanningKey === line.key ? (
                        <div className="max-w-md">
                          <BarcodeScanner onDetected={(text) => addScanned(line.key, text)} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="addProduct">Add an item</Label>
              <Select id="addProduct" value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                <option value="">Choose a product…</option>
                <optgroup label="Serial-tracked">
                  {serialized.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Bulk items">
                  {bulk.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={addLine} disabled={!addProductId}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Field label="Notes" id="notes">
            <Textarea id="notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Damaged boxes, short supply, transporter…" />
          </Field>
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lines</dt>
              <dd className="tabular-nums">{lines.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Units</dt>
              <dd className="tabular-nums">{lines.reduce((n, l) => n + l.qty, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Serials</dt>
              <dd className="tabular-nums">{lines.reduce((n, l) => n + (productsById.get(l.productId)?.isSerialized ? splitSerials(l.serialsText).length : 0), 0)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <dt>Value at cost</dt>
              <dd className="tabular-nums">{formatINR(totalPaise)}</dd>
            </div>
          </dl>
          <Button type="button" size="lg" className="mt-4 w-full" onClick={submit} disabled={pending}>
            <PackageCheck aria-hidden="true" />
            {pending ? "Receiving…" : "Receive into stock"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Each serial is registered In stock with its own cost, so job costing uses what that exact unit cost.</p>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, id, error, required, children }: { label: string; id: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-danger-foreground"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
