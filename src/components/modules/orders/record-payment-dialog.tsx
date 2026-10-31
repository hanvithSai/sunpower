"use client";

/**
 * Record a customer payment against an order (or an invoice). The first
 * payment on an order confirms it — the dialog says so up front so nobody is
 * surprised when the warehouse and crew get their work.
 */
import { useState } from "react";
import { IndianRupee } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { PAYMENT_MODE_LABELS, PAYMENT_TYPE_LABELS, options, type PaymentType } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { recordPaymentAction } from "@/server/actions/orders";

type Props = {
  outstandingPaise: number;
  orderId?: string;
  invoiceId?: string;
  ticketId?: string;
  /** Today in IST as YYYY-MM-DD (computed on the server). */
  today: string;
  confirmsOrder?: boolean;
  defaultType?: PaymentType;
  label?: string;
};

export function RecordPaymentDialog({ outstandingPaise, orderId, invoiceId, ticketId, today, confirmsOrder, defaultType = "advance", label = "Record payment" }: Props) {
  const [open, setOpen] = useState(false);
  const outstandingRs = outstandingPaise / 100;
  const suggested = defaultType === "advance" ? Math.round(outstandingRs / 2) : outstandingRs;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IndianRupee aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Outstanding: <span className="font-medium text-foreground">{formatINR(outstandingPaise)}</span>
            {confirmsOrder ? " — this first payment confirms the order, sends the pick list to the warehouse and books the installation crew." : ""}
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={recordPaymentAction} onSuccess={() => setOpen(false)} className="space-y-4">
          {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}
          {invoiceId ? <input type="hidden" name="invoiceId" value={invoiceId} /> : null}
          {ticketId ? <input type="hidden" name="ticketId" value={ticketId} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Amount (₹)" name="amount" required>
              <Input id="amount" name="amount" type="number" inputMode="decimal" min={1} max={outstandingRs} step="0.01" required defaultValue={suggested} />
            </FormField>
            <FormField label="Type" name="type" required>
              <Select id="type" name="type" defaultValue={defaultType}>
                {options(PAYMENT_TYPE_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Mode" name="mode" required>
              <Select id="mode" name="mode" defaultValue="upi">
                {options(PAYMENT_MODE_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Received on" name="receivedOn" required>
              <Input id="receivedOn" name="receivedOn" type="date" max={today} defaultValue={today} required />
            </FormField>
            <FormField label="Reference" name="reference" hint="UPI ref, UTR or cheque number" className="sm:col-span-2">
              <Input id="reference" name="reference" maxLength={60} />
            </FormField>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
