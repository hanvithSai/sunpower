/**
 * Read-only bill of materials with GST totals — shared by the quote page, the
 * printable quotation and the order page (orders snapshot the quote lines).
 */
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/lib/constants";
import { gstBreakup } from "@/lib/gst";
import { formatINR } from "@/lib/money";

export type DisplayLine = {
  sku: string;
  name: string;
  category: ProductCategory;
  hsn: string;
  qty: number;
  unit: string;
  unitPricePaise: number;
  gstRate: number;
};

const UNIT_LABEL: Record<string, string> = { nos: "nos", m: "m", set: "set", kit: "kit", job: "job", kw: "kW" };

export function QuoteLines({
  lines,
  totals,
  showHsn = false,
}: {
  lines: DisplayLine[];
  totals: { taxablePaise: number; gstPaise: number; totalPaise: number; subsidyPaise?: number; netCostPaise?: number };
  showHsn?: boolean;
}) {
  const breakup = gstBreakup(lines.map((l) => ({ qty: l.qty, unitPricePaise: l.unitPricePaise, gstRate: l.gstRate })));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Item</TableHead>
          {showHsn ? <TableHead>HSN/SAC</TableHead> : null}
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">GST</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, i) => (
          <TableRow key={`${line.sku}-${i}`}>
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell>
              <p className="font-medium text-foreground">{line.name}</p>
              <p className="text-xs text-muted-foreground">
                {line.sku} · {PRODUCT_CATEGORY_LABELS[line.category]}
              </p>
            </TableCell>
            {showHsn ? <TableCell className="font-mono text-xs">{line.hsn}</TableCell> : null}
            <TableCell className="whitespace-nowrap text-right tabular-nums">
              {line.qty} {UNIT_LABEL[line.unit] ?? line.unit}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(line.unitPricePaise)}</TableCell>
            <TableCell className="text-right tabular-nums">{line.gstRate}%</TableCell>
            <TableCell className="text-right tabular-nums">{formatINR(Math.round(line.qty * line.unitPricePaise))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TotalRow cols={showHsn ? 6 : 5} label="Taxable value" value={formatINR(totals.taxablePaise)} />
        {breakup.map((b) => (
          <TotalRow
            key={b.rate}
            cols={showHsn ? 6 : 5}
            label={`GST @ ${b.rate}% on ${formatINR(b.taxablePaise)} (CGST ${b.rate / 2}% + SGST ${b.rate / 2}%)`}
            value={formatINR(b.gstPaise)}
            muted
          />
        ))}
        <TotalRow cols={showHsn ? 6 : 5} label="Total (incl. GST)" value={formatINR(totals.totalPaise)} strong />
        {totals.subsidyPaise ? (
          <>
            <TotalRow cols={showHsn ? 6 : 5} label="Estimated PM Surya Ghar subsidy (credited to you by the government)" value={`− ${formatINR(totals.subsidyPaise)}`} muted />
            <TotalRow cols={showHsn ? 6 : 5} label="Effective cost after subsidy" value={formatINR(totals.netCostPaise ?? totals.totalPaise - totals.subsidyPaise)} strong />
          </>
        ) : null}
      </TableFooter>
    </Table>
  );
}

function TotalRow({ cols, label, value, strong, muted }: { cols: number; label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className={muted ? "text-right text-xs text-muted-foreground" : "text-right font-medium"}>
        {label}
      </TableCell>
      <TableCell className={strong ? "text-right text-base font-semibold tabular-nums" : "text-right tabular-nums"}>{value}</TableCell>
    </TableRow>
  );
}
