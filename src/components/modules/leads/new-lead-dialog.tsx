"use client";

/**
 * "New enquiry" dialog for leads that arrive by WhatsApp, phone, walk-in or
 * referral. Opens from the button or a `?new=1` link (the ⌘K quick action),
 * and lands the user on the new lead after saving.
 */
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
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
import type { ActionState } from "@/lib/action-state";
import { createLeadAction } from "@/server/actions/leads";
import { LeadFields } from "./lead-fields";

export function NewLeadDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("new") === "1";
  const [manualOpen, setManualOpen] = useState(false);
  const open = manualOpen || requested;

  function setOpen(next: boolean) {
    setManualOpen(next);
    if (!next && requested) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    }
  }

  function handleSuccess(state: ActionState) {
    setOpen(false);
    const leadId = state?.data?.leadId;
    if (typeof leadId === "string") router.push(`/leads/${leadId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          New enquiry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New enquiry</DialogTitle>
          <DialogDescription>
            Log an enquiry that came in by WhatsApp, a phone call or a walk-in. A repeat enquiry from the same number is added to the
            customer&apos;s open lead.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={createLeadAction} onSuccess={handleSuccess} className="space-y-6">
          <LeadFields withSource />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Saving…">Create enquiry</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
