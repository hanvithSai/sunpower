"use client";

/** Record why a customer declined a quote (sales can still revise it later). */
import { useState } from "react";
import { ThumbsDown } from "lucide-react";
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
import { rejectQuoteAction } from "@/server/actions/quotes";

export function DeclineQuoteDialog({ quoteId }: { quoteId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ThumbsDown aria-hidden="true" />
          Declined
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customer declined this quote?</DialogTitle>
          <DialogDescription>Note the reason. You can send a revised quote afterwards.</DialogDescription>
        </DialogHeader>
        <ActionForm action={rejectQuoteAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="quoteId" value={quoteId} />
          <FormField label="Reason" name="reason" required>
            <Input id="reason" name="reason" required maxLength={300} placeholder="E.g. wants a smaller system, comparing other installers" />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingText="Saving…">
              Mark declined
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
