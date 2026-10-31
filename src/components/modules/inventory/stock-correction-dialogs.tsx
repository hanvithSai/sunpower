"use client";

/**
 * Director-only stock corrections, each with a reason that lands on the
 * ledger: adjust a bulk item after a physical count, or write off one damaged
 * serial-tracked unit (it becomes Faulty and leaves stock).
 */
import { useState } from "react";
import { PackageMinus, SlidersHorizontal } from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adjustStockAction, writeOffSerialAction } from "@/server/actions/inventory";

function Footer({ label }: { label: string }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </DialogClose>
      <SubmitButton pendingText="Saving…">{label}</SubmitButton>
    </DialogFooter>
  );
}

export function AdjustStockDialog({ productId, name, unit, onHand }: { productId: string; name: string; unit: string; onHand: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Adjust stock of ${name}`}>
          <SlidersHorizontal aria-hidden="true" />
          <span className="hidden xl:inline">Adjust</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {name}: {onHand} {unit} on hand. Use this after a physical count; new stock comes in through a goods receipt.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={adjustStockAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="productId" value={productId} />
          <FormField label={`Change (${unit})`} name="delta" required hint="Negative to remove, e.g. -12 for 12 m of cable cut short">
            <Input id="delta" name="delta" type="number" inputMode="numeric" step={1} required />
          </FormField>
          <FormField label="Reason" name="reason" required>
            <Input id="reason" name="reason" required maxLength={200} placeholder="Monthly count, damaged in storage…" />
          </FormField>
          <Footer label="Save correction" />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function WriteOffSerialDialog({ serial, productName }: { serial: string; productName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Write off ${serial}`}>
          <PackageMinus aria-hidden="true" />
          Write off
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write off {serial}</DialogTitle>
          <DialogDescription>{productName} leaves stock and is marked Faulty. Its history keeps the reason.</DialogDescription>
        </DialogHeader>
        <ActionForm action={writeOffSerialAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="serial" value={serial} />
          <FormField label="Reason" name="reason" required>
            <Input id="reason" name="reason" required maxLength={200} placeholder="Glass cracked while unloading" />
          </FormField>
          <Footer label="Write off" />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
