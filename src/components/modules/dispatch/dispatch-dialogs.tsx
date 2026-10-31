"use client";

/**
 * Dispatch and delivery dialogs on the packing bench.
 * Dispatch says up front that it issues the tax invoice; delivery says it
 * starts the warranties — so nobody is surprised by what happens next.
 */
import { useState } from "react";
import { PackageCheck, Truck } from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deliverOrderAction, dispatchOrderAction } from "@/server/actions/inventory";

export function DispatchDialog({ orderId, ready, missing }: { orderId: string; ready: boolean; missing: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!ready} title={ready ? undefined : missing}>
          <Truck aria-hidden="true" />
          Dispatch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispatch this order</DialogTitle>
          <DialogDescription>Stock leaves the warehouse and the GST tax invoice is issued, with payments received so far applied.</DialogDescription>
        </DialogHeader>
        <ActionForm action={dispatchOrderAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Vehicle number" name="vehicleNo" required className="sm:col-span-2">
              <Input id="vehicleNo" name="vehicleNo" required maxLength={16} placeholder="TS 09 EA 1234" autoCapitalize="characters" className="font-mono uppercase" />
            </FormField>
            <FormField label="Driver" name="driverName" required>
              <Input id="driverName" name="driverName" required maxLength={80} />
            </FormField>
            <FormField label="Driver phone" name="driverPhone">
              <Input id="driverPhone" name="driverPhone" type="tel" inputMode="tel" maxLength={15} />
            </FormField>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Dispatching…">Dispatch and issue invoice</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeliverDialog({ orderId, customerName }: { orderId: string; customerName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PackageCheck aria-hidden="true" />
          Mark delivered
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm delivery</DialogTitle>
          <DialogDescription>Every serial&apos;s warranty starts today — no dates to type. The crew can start the installation.</DialogDescription>
        </DialogHeader>
        <ActionForm action={deliverOrderAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormField label="Received by" name="receivedBy" required>
            <Input id="receivedBy" name="receivedBy" required maxLength={80} defaultValue={customerName} />
          </FormField>
          <FormField label="Note" name="note">
            <Textarea id="note" name="note" rows={2} maxLength={300} placeholder="Boxes stored in the garage, one carton dented…" />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Saving…">Confirm delivery</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
