"use client";

/**
 * PrintButton — opens the browser print dialog for quotes, tax invoices and certificates.
 * Hidden from the printout itself (data-print-hide); globals.css strips the app chrome.
 */
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export type PrintButtonProps = {
  /** Button text. Defaults to "Print". */
  label?: string;
};

export function PrintButton({ label = "Print" }: PrintButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} data-print-hide>
      <Printer aria-hidden="true" />
      {label}
    </Button>
  );
}
