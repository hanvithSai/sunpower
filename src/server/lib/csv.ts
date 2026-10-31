/**
 * Tiny CSV writer for report downloads (RFC 4180 quoting, CRLF line ends,
 * UTF-8 BOM so Excel opens ₹ and Indian names correctly; text that would start
 * a formula is prefixed with an apostrophe).
 */
export type CsvValue = string | number | boolean | null | undefined | Date;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  // Names come from the public enquiry form: never let one run as a spreadsheet formula.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
