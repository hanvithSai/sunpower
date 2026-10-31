/**
 * GST maths for quotes and tax invoices.
 *
 * Prices are GST-exclusive. Each line is taxed at its product's rate
 * (after GST 2.0, Sept 2025: solar equipment 5%, batteries 18%, installation
 * service 18% — configurable per product). SunPower and its customers are in
 * Telangana, so tax splits into equal CGST + SGST; an out-of-state buyer would
 * pay IGST instead.
 */

export interface TaxLineInput {
  qty: number;
  unitPricePaise: number;
  gstRate: number;
}

export interface TaxLineResult {
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
}

export interface TaxSummary {
  taxablePaise: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

export function computeLine(line: TaxLineInput): TaxLineResult {
  const taxablePaise = Math.round(line.qty * line.unitPricePaise);
  const gstPaise = Math.round((taxablePaise * line.gstRate) / 100);
  return { taxablePaise, gstPaise, totalPaise: taxablePaise + gstPaise };
}

export function summarize(lines: TaxLineInput[], opts: { interState?: boolean } = {}): TaxSummary {
  let taxablePaise = 0;
  let gstPaise = 0;
  for (const line of lines) {
    const r = computeLine(line);
    taxablePaise += r.taxablePaise;
    gstPaise += r.gstPaise;
  }
  // CGST and SGST must add back up to the exact GST amount.
  const cgstPaise = opts.interState ? 0 : Math.round(gstPaise / 2);
  const sgstPaise = opts.interState ? 0 : gstPaise - cgstPaise;
  const igstPaise = opts.interState ? gstPaise : 0;
  return { taxablePaise, gstPaise, cgstPaise, sgstPaise, igstPaise, totalPaise: taxablePaise + gstPaise };
}

/** Rate-wise breakup printed at the foot of a tax invoice. */
export function gstBreakup(lines: TaxLineInput[]): { rate: number; taxablePaise: number; gstPaise: number }[] {
  const byRate = new Map<number, { taxablePaise: number; gstPaise: number }>();
  for (const line of lines) {
    const r = computeLine(line);
    const acc = byRate.get(line.gstRate) ?? { taxablePaise: 0, gstPaise: 0 };
    acc.taxablePaise += r.taxablePaise;
    acc.gstPaise += r.gstPaise;
    byRate.set(line.gstRate, acc);
  }
  return [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, ...v }));
}
