"use client";

/**
 * Quote builder. Pick a ready-made package and the complete bill of materials
 * fills in (panels, inverter, stands, boxes, cables, connectors, earthing,
 * installation) — nobody has to remember the small parts. Quantities and unit
 * prices stay editable; totals, GST and the PM Surya Ghar subsidy update live
 * and are recomputed on the server when saved.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  SYSTEM_TYPE_LABELS,
  type CustomerType,
  type SystemType,
} from "@/lib/constants";
import { formatINR, formatPercent } from "@/lib/money";
import { expandPackage, lineFromProduct, missingComponents, quoteTotals, type CatalogProduct, type QuoteLine } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";
import { saveQuoteAction } from "@/server/actions/quotes";
import type { PackageOption } from "@/server/services/catalog";

type Props = {
  lead: { id: string; number: string; name: string; wantsSubsidy: boolean };
  customerType: CustomerType;
  catalog: { products: CatalogProduct[]; packages: PackageOption[] };
  defaultPackageId?: string;
  from: {
    number: string;
    capacityKw: number;
    systemType: SystemType;
    packageId?: string;
    notes?: string;
    lines: { productId: string; qty: number; unitPricePaise: number }[];
  } | null;
};

const KW_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

export function QuoteBuilder({ lead, customerType, catalog, defaultPackageId, from }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const productsById = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products]);
  const packagesById = useMemo(() => new Map(catalog.packages.map((p) => [p.id, p])), [catalog.packages]);

  const initialPackage = packagesById.get(from?.packageId ?? defaultPackageId ?? "");
  const [packageId, setPackageId] = useState<string | undefined>(initialPackage?.id);
  const [capacityKw, setCapacityKw] = useState<number>(from?.capacityKw ?? initialPackage?.capacityKw ?? 3);
  const [systemType, setSystemType] = useState<SystemType>(from?.systemType ?? initialPackage?.systemType ?? "on_grid");
  const [notes, setNotes] = useState(from?.notes ?? "");
  const [lines, setLines] = useState<QuoteLine[]>(() => {
    if (from) {
      return from.lines.flatMap((l) => {
        const product = productsById.get(l.productId);
        return product ? [lineFromProduct(product, l.qty, l.unitPricePaise)] : [];
      });
    }
    return initialPackage ? expandPackage(initialPackage.lines, productsById) : [];
  });
  const [addProductId, setAddProductId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendWithMissing, setSendWithMissing] = useState(false);
  // R-24: nobody has to remember the small parts; a gap needs an explicit OK before sending.
  const missing = useMemo(() => missingComponents(systemType, lines), [systemType, lines]);

  const totals = useMemo(
    () => quoteTotals(lines, { capacityKw, systemType, customerType, wantsSubsidy: lead.wantsSubsidy }),
    [lines, capacityKw, systemType, customerType, lead.wantsSubsidy],
  );

  function choosePackage(pkg: PackageOption) {
    setPackageId(pkg.id);
    setCapacityKw(pkg.capacityKw);
    setSystemType(pkg.systemType);
    setLines(expandPackage(pkg.lines, productsById));
    setError(null);
  }

  function updateLine(index: number, patch: Partial<Pick<QuoteLine, "qty" | "unitPricePaise">>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    const product = productsById.get(addProductId);
    if (!product) return;
    setLines((current) => {
      const existing = current.findIndex((l) => l.productId === product.id);
      if (existing >= 0) return current.map((l, i) => (i === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...current, lineFromProduct(product, 1)];
    });
    setAddProductId("");
  }

  function save(send: boolean) {
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (lines.some((l) => !(l.qty > 0))) {
      setError("Every item needs a quantity above zero.");
      return;
    }
    if (send && missing.length > 0 && !sendWithMissing) {
      setError("Add the missing parts, or tick “Send without” to send anyway. You can also save a draft.");
      return;
    }
    startTransition(async () => {
      const result = await saveQuoteAction({
        leadId: lead.id,
        packageId,
        capacityKw,
        systemType,
        notes: notes.trim() || undefined,
        send,
        sendWithMissing: send && sendWithMissing,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPriceRs: l.unitPricePaise / 100 })),
      });
      if (result?.ok) {
        toast.success(result.message ?? "Quote saved");
        const quoteId = result.data?.quoteId;
        router.push(typeof quoteId === "string" ? `/quotes/${quoteId}` : "/quotes");
      } else {
        const message = result?.message ?? "Could not save the quote.";
        setError(message);
        toast.error(message);
      }
    });
  }

  const onGrid = catalog.packages.filter((p) => p.systemType === "on_grid");
  const offGrid = catalog.packages.filter((p) => p.systemType === "off_grid");
  const panelSets = catalog.packages.filter((p) => p.systemType === "panel_set");
  const marginPct = totals.taxablePaise ? (totals.marginPaise / totals.taxablePaise) * 100 : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section aria-labelledby="pkg-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="pkg-heading" className="text-base font-semibold text-foreground">
            1. Choose a package
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">The full bill of materials fills in automatically. You can still edit it below.</p>
          {[
            { title: "On-Grid (net metering)", items: onGrid },
            { title: "Off-Grid (battery backup)", items: offGrid },
            { title: "Panel Set (hardware only: panels, connectors, cable)", items: panelSets },
          ].filter((group) => group.items.length > 0).map((group) => (
            <div key={group.title} className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {group.items.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => choosePackage(pkg)}
                    aria-pressed={pkg.id === packageId}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-colors",
                      pkg.id === packageId ? "border-primary bg-primary/8 ring-1 ring-primary" : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">{pkg.capacityKw} kW</span>
                    <span className="block text-xs text-muted-foreground">{pkg.code}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="bom-heading" className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-3">
            <div>
              <h2 id="bom-heading" className="text-base font-semibold text-foreground">
                2. Bill of materials
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{lines.length} items · prices exclude GST</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="capacity">System size</Label>
                <Select id="capacity" value={String(capacityKw)} onChange={(e) => setCapacityKw(Number(e.target.value))}>
                  {KW_OPTIONS.map((kw) => (
                    <option key={kw} value={kw}>
                      {kw} kW
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="systemType">Type</Label>
                <Select id="systemType" value={systemType} onChange={(e) => setSystemType(e.target.value as SystemType)}>
                  {Object.entries(SYSTEM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-32">Unit price (₹)</TableHead>
                <TableHead className="hidden w-16 sm:table-cell">GST</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={line.productId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.sku} · {PRODUCT_CATEGORY_LABELS[line.category]}
                      {line.isSerialized ? " · serial tracked" : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Quantity of ${line.name}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={line.unit === "m" ? 1 : line.unit === "kw" ? 0.5 : 1}
                      value={Number.isFinite(line.qty) ? line.qty : ""}
                      onChange={(e) => updateLine(index, { qty: Number(e.target.value) })}
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Unit price of ${line.name}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      value={line.unitPricePaise / 100}
                      onChange={(e) => updateLine(index, { unitPricePaise: Math.round(Number(e.target.value) * 100) })}
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{line.gstRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Math.round(line.qty * line.unitPricePaise))}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-end gap-2 border-t border-border p-5">
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor="addProduct">Add an item</Label>
              <Select id="addProduct" value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                <option value="">Choose from the catalog…</option>
                {PRODUCT_CATEGORIES.map((category) => {
                  const items = catalog.products.filter((p) => p.category === category);
                  return items.length ? (
                    <optgroup key={category} label={PRODUCT_CATEGORY_LABELS[category]}>
                      {items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatINR(p.pricePaise)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={addLine} disabled={!addProductId}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Label htmlFor="notes">3. Notes for the customer</Label>
          <Textarea
            id="notes"
            className="mt-2"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g. includes net meter application, 3 chemical earthing pits, 5-year workmanship warranty"
          />
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <p className="text-sm text-muted-foreground">Quote for</p>
            <p className="font-semibold text-foreground">{lead.name}</p>
            <p className="text-xs text-muted-foreground">
              {lead.number} · {capacityKw} kW {SYSTEM_TYPE_LABELS[systemType]}
            </p>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Taxable value" value={formatINR(totals.taxablePaise)} />
            <Row label="GST" value={formatINR(totals.gstPaise)} />
            <div className="border-t border-border pt-2">
              <Row label="Total" value={formatINR(totals.totalPaise)} strong />
            </div>
            {totals.subsidyPaise > 0 ? (
              <>
                <Row label="PM Surya Ghar subsidy" value={`− ${formatINR(totals.subsidyPaise)}`} tone="success" />
                <div className="rounded-xl bg-success/10 p-3">
                  <Row label="Effective cost after subsidy" value={formatINR(totals.netCostPaise)} strong />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {systemType === "panel_set"
                  ? "Panel Sets are hardware only, so the PM Surya Ghar subsidy doesn't apply."
                  : systemType === "off_grid"
                    ? "Off-grid systems aren't covered by the PM Surya Ghar subsidy."
                    : customerType !== "residential"
                      ? "The subsidy applies to homes only."
                      : "The customer didn't ask for subsidy help."}
              </p>
            )}
          </dl>
          <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs">
            <span className="text-muted-foreground">Margin before labour (internal)</span>
            <Badge variant={marginPct < 15 ? "warning" : "success"}>
              {formatINR(totals.marginPaise)} · {formatPercent(totals.marginPaise, totals.taxablePaise)}
            </Badge>
          </div>
          {missing.length > 0 ? (
            <div role="status" className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex items-start gap-2 font-medium text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Missing from this {SYSTEM_TYPE_LABELS[systemType]}: {missing.map((c) => PRODUCT_CATEGORY_LABELS[c].toLowerCase()).join(", ")}
              </p>
              <label className="flex items-start gap-2 text-xs text-foreground">
                <Checkbox checked={sendWithMissing} onChange={(e) => setSendWithMissing(e.target.checked)} className="mt-0.5" />
                Send without {missing.length === 1 ? "it" : "them"} (it is written on the timeline)
              </label>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Button type="button" onClick={() => save(true)} disabled={pending}>
              <Send aria-hidden="true" />
              {pending ? "Saving…" : "Save & mark as sent"}
            </Button>
            <Button type="button" variant="outline" onClick={() => save(false)} disabled={pending}>
              <Save aria-hidden="true" />
              Save draft
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "text-base font-semibold text-foreground", tone === "success" && "text-success-foreground")}>
        {value}
      </dd>
    </div>
  );
}
