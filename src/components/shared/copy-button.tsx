"use client";

/**
 * CopyButton — copies a value (share link, serial number, UPI ID) to the clipboard.
 * Icon-only when no `label` is given. Falls back to a hidden textarea where the async
 * Clipboard API is unavailable (e.g. a demo served over plain http on the LAN).
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CopyButtonProps = {
  value: string;
  /** Visible text, e.g. "Copy link". Omit for an icon-only button. */
  label?: string;
};

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Copy command was rejected");
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn’t copy. Select the text and copy it manually.");
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant="outline"
      size={label ? "sm" : "icon"}
      onClick={handleCopy}
      aria-label={label ? undefined : copied ? "Copied" : "Copy to clipboard"}
      title={label ? undefined : "Copy to clipboard"}
      className={cn(!label && "size-8")}
      data-print-hide
    >
      <Icon className={cn(copied && "text-success-foreground")} aria-hidden="true" />
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  );
}
