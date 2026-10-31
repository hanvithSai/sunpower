"use client";

/** Director-only: cancel an order before dispatch (frees serials and the crew slot). */
import { useState } from "react";
import { Ban } from "lucide-react";
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
import { cancelOrderAction } from "@/server/actions/orders";

export function CancelOrderDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-danger-foreground">
          <Ban aria-hidden="true" />
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>Any serials allocated on the pick list go back to stock and the installation booking is cancelled.</DialogDescription>
        </DialogHeader>
        <ActionForm action={cancelOrderAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormField label="Reason" name="reason" required>
            <Input id="reason" name="reason" required maxLength={300} />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Keep order
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingText="Cancelling…">
              Cancel order
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
