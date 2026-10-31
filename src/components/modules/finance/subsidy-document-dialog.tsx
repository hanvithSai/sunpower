"use client";

/**
 * Keep a subsidy paper on the order's file: pick what it is, photograph it
 * (the phone camera opens straight away), add a reference note. Photos upload
 * to GridFS while the form is open, so saving is instant.
 */
import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { ActionForm, useFieldError } from "@/components/shared/action-form";
import { FormField } from "@/components/shared/form-field";
import { MediaUploader } from "@/components/shared/media-uploader";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { options, SUBSIDY_DOC_LABELS, type SubsidyDocKind } from "@/lib/constants";
import { addSubsidyDocumentAction } from "@/server/actions/finance";

function PhotosError() {
  const error = useFieldError("photos");
  return error ? (
    <p role="alert" className="text-xs text-danger-foreground">
      {error}
    </p>
  ) : null;
}

export function SubsidyDocumentDialog({ orderId, suggested = "feasibility_letter" }: { orderId: string; suggested?: SubsidyDocKind }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FilePlus2 aria-hidden="true" />
          Add paper
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a subsidy paper</DialogTitle>
          <DialogDescription>Photograph the letter or meter so it stays with this customer&apos;s file.</DialogDescription>
        </DialogHeader>
        <ActionForm action={addSubsidyDocumentAction} onSuccess={() => setOpen(false)} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormField label="Document" name="kind" required>
            <Select id="kind" name="kind" defaultValue={suggested}>
              {options(SUBSIDY_DOC_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Photos</legend>
            <MediaUploader name="photos" accept="image" maxFiles={6} label="One photo per page" />
            <PhotosError />
          </fieldset>
          <FormField label="Reference" name="note">
            <Input id="note" name="note" maxLength={200} placeholder="Letter number, officer, meter number…" />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pendingText="Saving…">Save to file</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
