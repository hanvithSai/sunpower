"use client";

/**
 * The packing bench: scan serials with the phone camera (or type them), tick
 * bulk lines, and watch the pick list fill up. Every scan goes to the server,
 * which refuses wrong products, units packed for another order and anything
 * not in stock — the reason shows in the big result banner. Page data refreshes
 * after each action (the actions revalidate this route).
 */
import { useRef, useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/shared/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScanMethod } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bulkPickAction, scanSerialAction, unscanSerialAction } from "@/server/actions/inventory";

export type BenchLine = {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  isSerialized: boolean;
  picked: boolean;
  onHand: number;
  warrantyMonths: number;
  serials: { serial: string; status?: string; warrantyEndAt?: Date | string }[];
};

type Feedback = { ok: boolean; text: string } | null;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

export function PackingBench({ orderId, lines, canPack }: { orderId: string; lines: BenchLine[]; canPack: boolean }) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [scanning, startScan] = useTransition();
  const [, startUpdate] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scan(serial: string, method: ScanMethod) {
    const value = serial.trim();
    if (!value) return;
    startScan(async () => {
      const result = await scanSerialAction(null, form({ orderId, serial: value, method }));
      setFeedback({ ok: Boolean(result?.ok), text: result?.message ?? (result?.ok ? "Added" : "Couldn't add that serial") });
      if (!result?.ok) {
        try {
          navigator.vibrate?.([80, 60, 80]);
        } catch {
          // best-effort
        }
      }
    });
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputRef.current?.value ?? "";
    scan(value, "manual");
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }

  function remove(serial: string) {
    setBusyKey(serial);
    startUpdate(async () => {
      const result = await unscanSerialAction(null, form({ orderId, serial }));
      if (result?.ok) toast.success(result.message ?? "Removed");
      else toast.error(result?.message ?? "Couldn't remove that serial");
      setBusyKey(null);
    });
  }

  function toggleBulk(productId: string, picked: boolean) {
    setBusyKey(productId);
    startUpdate(async () => {
      const result = await bulkPickAction(null, form({ orderId, productId, picked: String(picked) }));
      if (!result?.ok) toast.error(result?.message ?? "Couldn't update that line");
      setBusyKey(null);
    });
  }

  const serialLines = lines.filter((l) => l.isSerialized);
  const bulkLines = lines.filter((l) => !l.isSerialized);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      {canPack ? (
        <section aria-labelledby="scan-heading" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20 lg:self-start">
          <h2 id="scan-heading" className="text-base font-semibold text-foreground">
            Scan serials
          </h2>
          <BarcodeScanner onDetected={(serial) => scan(serial, "camera")} paused={scanning} />
          <form onSubmit={onManualSubmit} className="space-y-1.5">
            <Label htmlFor="manual-serial">Or type a serial</Label>
            <div className="flex gap-2">
              <Input id="manual-serial" ref={inputRef} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="e.g. WAA545-2609-0007" className="font-mono" />
              <Button type="submit" disabled={scanning}>
                {scanning ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                Add
              </Button>
            </div>
          </form>
          <div aria-live="assertive" className="min-h-14">
            {feedback ? (
              <p
                className={cn(
                  "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium",
                  feedback.ok ? "bg-success/12 text-success-foreground" : "bg-danger/10 text-danger-foreground",
                )}
              >
                {feedback.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                {feedback.text}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Every panel, inverter and controller must be scanned before dispatch.</p>
            )}
          </div>
        </section>
      ) : null}

      <div className={cn("space-y-6", !canPack && "lg:col-span-2")}>
        <section aria-labelledby="serial-lines" className="rounded-2xl border border-border bg-card shadow-sm">
          <h2 id="serial-lines" className="px-5 pt-5 text-base font-semibold text-foreground">
            Serial-tracked items
          </h2>
          <ul className="divide-y divide-border">
            {serialLines.map((line) => {
              const done = line.serials.length >= line.qty;
              return (
                <li key={line.productId} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{line.sku}</span> · {line.warrantyMonths ? `${line.warrantyMonths / 12} yr warranty` : "no warranty"}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums", done ? "bg-success/14 text-success-foreground" : "bg-warning/14 text-warning-foreground")}>
                      {line.serials.length}/{line.qty}
                    </span>
                  </div>
                  {line.serials.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {line.serials.map((s) => (
                        <li key={s.serial} className="flex items-center gap-1 rounded-lg bg-secondary py-1 pl-2.5 pr-1 font-mono text-xs">
                          <span>{s.serial}</span>
                          {s.warrantyEndAt ? <span className="font-sans text-muted-foreground">· to {formatDate(s.warrantyEndAt)}</span> : null}
                          {canPack ? (
                            <button
                              type="button"
                              onClick={() => remove(s.serial)}
                              disabled={busyKey === s.serial}
                              aria-label={`Remove ${s.serial}`}
                              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                            >
                              {busyKey === s.serial ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                            </button>
                          ) : (
                            <span className="w-1.5" />
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Nothing scanned yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="bulk-lines" className="rounded-2xl border border-border bg-card shadow-sm">
          <h2 id="bulk-lines" className="px-5 pt-5 text-base font-semibold text-foreground">
            Bulk items
          </h2>
          <p className="px-5 text-sm text-muted-foreground">Count these onto the truck and tick each line.</p>
          <ul className="mt-2 divide-y divide-border">
            {bulkLines.map((line) => {
              const short = line.onHand < line.qty;
              return (
                <li key={line.productId}>
                  <label className={cn("flex min-h-14 items-center gap-3 px-5 py-3", canPack ? "cursor-pointer" : "cursor-default")}>
                    <Checkbox
                      checked={line.picked}
                      disabled={!canPack || busyKey === line.productId}
                      onChange={(e) => toggleBulk(line.productId, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">{line.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        <span className="font-mono">{line.sku}</span>
                        {canPack ? <span className={short ? " font-medium text-danger-foreground" : ""}> · {line.onHand} on hand</span> : null}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">× {line.qty}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
