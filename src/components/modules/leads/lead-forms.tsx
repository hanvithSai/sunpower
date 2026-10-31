"use client";

/**
 * Forms on the lead page: the qualification call checklist, booking the site
 * survey, changing the owner and closing a lead as lost. Each posts to a
 * Server Action through <ActionForm>, which shows toasts and field errors.
 */
import { useState } from "react";
import { CalendarClock, UserRound, XCircle } from "lucide-react";
import { ActionForm } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ROOF_TYPE_LABELS, options } from "@/lib/constants";
import { SQFT_PER_KW } from "@/lib/validation/leads";
import { assignLeadAction, markLeadLostAction, qualifyLeadAction, scheduleSurveyAction } from "@/server/actions/leads";

type Option = { id: string; name: string };

/* ------------------------------ Qualify ------------------------------ */

export function QualifyForm({ leadId, requestedKw, monthlyBillRs }: { leadId: string; requestedKw: number; monthlyBillRs?: number }) {
  const [shadowFree, setShadowFree] = useState<number | null>(null);
  const fitsKw = shadowFree !== null ? Math.floor((shadowFree / SQFT_PER_KW) * 10) / 10 : null;

  const hint =
    fitsKw === null ? (
      `About ${SQFT_PER_KW} sq ft of shadow-free roof per kW`
    ) : fitsKw >= requestedKw ? (
      <span className="text-success-foreground">Fits about {fitsKw} kW — enough for the {requestedKw} kW requested</span>
    ) : (
      <span className="text-warning-foreground">Fits about {fitsKw} kW — less than the {requestedKw} kW requested</span>
    );

  return (
    <ActionForm action={qualifyLeadAction} className="space-y-5">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Total roof area (sq ft)" name="roofAreaSqft" required>
          <Input id="roofAreaSqft" name="roofAreaSqft" type="number" inputMode="numeric" min={20} required />
        </FormField>
        <FormField label="Shadow-free area (sq ft)" name="shadowFreeAreaSqft" required hint={hint}>
          <Input
            id="shadowFreeAreaSqft"
            name="shadowFreeAreaSqft"
            type="number"
            inputMode="numeric"
            min={0}
            required
            onChange={(e) => setShadowFree(e.target.value === "" ? null : Number(e.target.value))}
          />
        </FormField>
        <FormField label="Monthly electricity bill (₹)" name="monthlyBillRs" required>
          <Input id="monthlyBillRs" name="monthlyBillRs" type="number" inputMode="numeric" min={0} step={50} required defaultValue={monthlyBillRs} />
        </FormField>
        <FormField label="Sanctioned load (kW)" name="sanctionedLoadKw" hint="Printed on the electricity bill">
          <Input id="sanctionedLoadKw" name="sanctionedLoadKw" type="number" inputMode="decimal" min={0} step={0.5} />
        </FormField>
        <FormField label="Roof type" name="roofType" required>
          <Select id="roofType" name="roofType" defaultValue="rcc">
            {options(ROOF_TYPE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-start gap-3 self-end pb-2">
          <Checkbox id="gridSuitable" name="gridSuitable" defaultChecked className="mt-0.5" />
          <label htmlFor="gridSuitable" className="text-sm leading-snug">
            Grid connection is suitable for net metering
          </label>
        </div>
        <FormField label="Call notes" name="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={3} maxLength={1000} placeholder="What the customer told us on the call" />
        </FormField>
      </div>
      <SubmitButton pendingText="Saving…">Mark qualified</SubmitButton>
    </ActionForm>
  );
}

/* --------------------------- Schedule survey -------------------------- */

export function ScheduleSurveyForm({ leadId, technicians, defaultWhen }: { leadId: string; technicians: Option[]; defaultWhen: string }) {
  return (
    <ActionForm action={scheduleSurveyAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="leadId" value={leadId} />
      <FormField label="Technician" name="technicianId" required>
        <Select id="technicianId" name="technicianId" required defaultValue="">
          <option value="" disabled>
            Choose a technician
          </option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Date & time (IST)" name="scheduledFor" required>
        <Input id="scheduledFor" name="scheduledFor" type="datetime-local" required defaultValue={defaultWhen} />
      </FormField>
      <SubmitButton pendingText="Booking…">
        <CalendarClock aria-hidden="true" />
        Book survey
      </SubmitButton>
    </ActionForm>
  );
}

/* ------------------------------ Owner ------------------------------- */

export function AssignOwnerForm({ leadId, owners, currentId }: { leadId: string; owners: Option[]; currentId?: string }) {
  return (
    <ActionForm action={assignLeadAction} className="flex items-end gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <FormField label="Owner" name="userId" className="flex-1">
        <Select id="userId" name="userId" defaultValue={currentId ?? ""} required>
          <option value="" disabled>
            Unassigned
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </FormField>
      <SubmitButton variant="outline" pendingText="Saving…">
        <UserRound aria-hidden="true" />
        Save
      </SubmitButton>
    </ActionForm>
  );
}

/* ------------------------------ Lost -------------------------------- */

const LOST_REASONS = [
  "Roof too shaded",
  "Budget too high",
  "Chose another installer",
  "Rented house — owner not interested",
  "Not reachable after 3 calls",
  "Grid connection not feasible",
];

export function MarkLostDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full text-danger-foreground">
          <XCircle aria-hidden="true" />
          Mark as lost
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this lead as lost?</DialogTitle>
          <DialogDescription>The reason helps the director see why deals slip. You can reopen the lead later.</DialogDescription>
        </DialogHeader>
        <ActionForm action={markLeadLostAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <FormField label="Reason" name="reason" required>
            <Input id="reason" name="reason" list="lost-reasons" required maxLength={300} placeholder="Pick or type a reason" />
          </FormField>
          <datalist id="lost-reasons">
            {LOST_REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingText="Closing…">
              Mark as lost
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
