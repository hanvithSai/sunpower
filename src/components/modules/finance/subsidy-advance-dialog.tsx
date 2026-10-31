"use client";

/**
 * Move a PM Surya Ghar file to its next stage. Only the stages the state
 * machine allows next are offered; "Applied" asks for the national portal
 * application number and "Disbursed" for the amount credited to the customer.
 * Dates are stamped by the server.
 */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { statusMeta, type SubsidyStatus } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { SUBSIDY_FLOW } from "@/lib/workflows";
import { advanceSubsidyAction } from "@/server/actions/finance";

export function SubsidyAdvanceDialog({ orderId, status, expectedPaise, size = "sm" }: { orderId: string; status: SubsidyStatus; expectedPaise: number; size?: "sm" | "default" }) {
  const next = SUBSIDY_FLOW[status];
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<SubsidyStatus>(next[0] ?? status);
  if (next.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={size}>
          {statusMeta("subsidy", next[0]!).label}
          <ArrowRight aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update the subsidy file</DialogTitle>
          <DialogDescription>Now: {statusMeta("subsidy", status).label}. Today&apos;s date is recorded with the step.</DialogDescription>
        </DialogHeader>
        <ActionForm action={advanceSubsidyAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormField label="Move to" name="status" required>
            <Select id="status" name="status" value={target} onChange={(e) => setTarget(e.target.value as SubsidyStatus)}>
              {next.map((s) => (
                <option key={s} value={s}>
                  {statusMeta("subsidy", s).label}
                </option>
              ))}
            </Select>
          </FormField>
          {target === "applied" ? (
            <FormField label="Portal application number" name="applicationNo" required hint="From pmsuryaghar.gov.in">
              <Input id="applicationNo" name="applicationNo" required maxLength={40} className="font-mono" />
            </FormField>
          ) : null}
          {target === "disbursed" ? (
            <FormField label="Amount credited (₹)" name="disbursed" required hint={`Expected ${formatINR(expectedPaise)}`}>
              <Input id="disbursed" name="disbursed" type="number" inputMode="decimal" min={1} step="0.01" required defaultValue={expectedPaise / 100} />
            </FormField>
          ) : null}
          <FormField label="Note" name="note">
            <Input id="note" name="note" maxLength={300} placeholder={target === "rejected" ? "Reason from the portal" : "Inspection officer, document reference…"} />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
