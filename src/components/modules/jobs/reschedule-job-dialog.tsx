"use client";

/**
 * Move a job or change its crew (sales / director). Technicians already
 * booked that day are marked, and saving still works — the toast names any
 * double booking so it is a conscious choice.
 */
import { useState } from "react";
import { CalendarClock } from "lucide-react";
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
import { rescheduleJobAction } from "@/server/actions/jobs";

type Technician = { id: string; name: string; skills: string[] };

export function RescheduleJobDialog({
  jobId,
  scheduledFor,
  minDate,
  crewIds,
  leadId,
  technicians,
}: {
  jobId: string;
  scheduledFor: string;
  minDate: string;
  crewIds: string[];
  leadId?: string;
  technicians: Technician[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(crewIds);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock aria-hidden="true" />
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule or change crew</DialogTitle>
          <DialogDescription>The crew sees the change in My work straight away.</DialogDescription>
        </DialogHeader>
        <ActionForm action={rescheduleJobAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="jobId" value={jobId} />
          <FormField label="Date and time" name="scheduledFor" required>
            <Input id="scheduledFor" name="scheduledFor" type="datetime-local" min={minDate} defaultValue={scheduledFor} required />
          </FormField>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Crew</legend>
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-2">
              {technicians.map((t) => (
                <label key={t.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-secondary/60">
                  <Checkbox
                    name="technicianIds"
                    value={t.id}
                    checked={selected.includes(t.id)}
                    onChange={(e) => setSelected((c) => (e.target.checked ? [...c, t.id] : c.filter((id) => id !== t.id)))}
                  />
                  <span className="truncate">{t.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <FormField label="Lead technician" name="leadTechnicianId">
            <Select id="leadTechnicianId" name="leadTechnicianId" defaultValue={leadId && selected.includes(leadId) ? leadId : selected[0]}>
              {technicians
                .filter((t) => selected.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Saving…" disabled={selected.length === 0}>
              Save
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
