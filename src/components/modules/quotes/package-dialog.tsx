"use client";

/**
 * A catalog package as a card that opens its full detail in a dialog: what the
 * system is, the price breakdown (excl. GST, GST, total, estimated subsidy,
 * after subsidy) and the complete bill of materials with unit prices. Every
 * figure comes from the same quote maths the builder uses (quoteTotals), so the
 * catalog and a fresh quote always agree.
 */
import Link from "next/link";
import { ArrowRight, Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SYSTEM_TYPE_LABELS, type SystemType } from "@/lib/constants";
import { formatINR } from "@/lib/money";

export type PackageDetail = {
  id: string;
  code: string;
  name: string;
  description: string;
  systemType: SystemType;
  capacityKw: number;
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
  subsidyPaise: number;
  netCostPaise: number;
  lines: { productId: string; name: string; qty: number; unit: string; unitPricePaise: number; gstRate: number; isSerialized: boolean }[];
};

const TYPE_BADGE: Record<SystemType, "info" | "brand" | "neutral"> = { on_grid: "info", off_grid: "brand", panel_set: "neutral" };

export function PackageDialog({ pkg, canQuote }: { pkg: PackageDetail; canQuote: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-input hover:shadow-md"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-display text-xl font-semibold text-foreground">{pkg.capacityKw} kW</span>
            <Badge variant={TYPE_BADGE[pkg.systemType]}>{SYSTEM_TYPE_LABELS[pkg.systemType]}</Badge>
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{pkg.code}</span>
          <span className="mt-3 text-sm font-medium text-foreground tabular-nums">{formatINR(pkg.totalPaise)}</span>
          {pkg.subsidyPaise ? (
            <span className="text-xs text-success-foreground tabular-nums">{formatINR(pkg.netCostPaise)} after subsidy</span>
          ) : (
            <span className="text-xs text-muted-foreground">No subsidy ({pkg.systemType === "panel_set" ? "hardware only" : "off-grid"})</span>
          )}
          <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-primary">
            View {pkg.lines.length} items
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{pkg.name}</DialogTitle>
            <Badge variant={TYPE_BADGE[pkg.systemType]}>{SYSTEM_TYPE_LABELS[pkg.systemType]}</Badge>
          </div>
          <DialogDescription>
            {pkg.code} · {pkg.description}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm sm:grid-cols-4">
          {[
            { k: "Price excl. GST", v: formatINR(pkg.taxablePaise) },
            { k: "GST", v: formatINR(pkg.gstPaise) },
            { k: "Total", v: formatINR(pkg.totalPaise), strong: true },
            {
              k: pkg.subsidyPaise ? "After subsidy (est.)" : "Subsidy",
              v: pkg.subsidyPaise ? formatINR(pkg.netCostPaise) : "Not eligible",
            },
          ].map((row) => (
            <div key={row.k} className="bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{row.k}</dt>
              <dd className={row.strong ? "mt-0.5 font-semibold text-foreground tabular-nums" : "mt-0.5 text-foreground tabular-nums"}>{row.v}</dd>
            </div>
          ))}
        </dl>
        {pkg.subsidyPaise ? (
          <p className="text-xs text-muted-foreground">
            PM Surya Ghar estimate {formatINR(pkg.subsidyPaise)} for a home under current rules, credited to the customer after the DISCOM inspection — not a
            discount on the invoice.
          </p>
        ) : null}

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="size-4 text-primary" aria-hidden="true" />
            Bill of materials
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit price</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pkg.lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-3 py-2">
                      <span className="text-foreground">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        GST {l.gstRate}%{l.isSerialized ? " · serial tracked" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {l.qty} {l.unit === "kw" ? "kW" : l.unit}
                    </td>
                    <td className="px-3 py-2 text-right">{formatINR(l.unitPricePaise)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatINR(Math.round(l.qty * l.unitPricePaise))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {canQuote ? (
          <DialogFooter>
            <Button asChild>
              <Link href="/leads?view=table&status=survey_approved">Quote this for a lead with an approved survey</Link>
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
