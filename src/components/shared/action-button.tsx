"use client";

/**
 * ActionButton — a one-click Server Action (approve, dispatch, mark paid …).
 *
 *   <ActionButton
 *     action={approveSurvey}
 *     hiddenFields={{ surveyId: survey.id }}
 *     successMessage="Survey approved"
 *   >
 *     Approve survey
 *   </ActionButton>
 *
 * Posts `hiddenFields` as form data. With `confirm`, an Apple-style alert asks first
 * (use `destructive: true` for irreversible actions). Shows a spinner while running and
 * toasts the result. Unexpected errors become an error toast; redirect() still works.
 */
import { useActionState, useId, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

import type { ActionState, FormAction } from "@/lib/action-state";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runFormAction, toastActionResult } from "@/components/shared/action-form";

export type ActionButtonProps = {
  action: FormAction;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Posted to the action as form fields, e.g. `{ id: lead.id, status: "won" }`. */
  hiddenFields?: Record<string, string>;
  /** Ask for confirmation in a dialog before running the action. */
  confirm?: {
    title: string;
    description?: string;
    confirmText?: string;
    destructive?: boolean;
  };
  successMessage?: string;
};

export function ActionButton({
  action,
  children,
  variant,
  size,
  className,
  hiddenFields,
  confirm,
  successMessage,
}: ActionButtonProps) {
  const formId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await runFormAction(action, prev, formData);
    toastActionResult(next, successMessage);
    setConfirmOpen(false);
    return next;
  }, null);

  const spinner = pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null;

  return (
    <>
      <form id={formId} action={formAction} className="contents">
        {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {confirm ? (
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={pending}
            aria-haspopup="dialog"
            onClick={() => setConfirmOpen(true)}
          >
            {spinner}
            {children}
          </Button>
        ) : (
          <Button
            type="submit"
            variant={variant}
            size={size}
            className={className}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {spinner}
            {children}
          </Button>
        )}
      </form>

      {confirm ? (
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            // Keep the dialog up while the action is running.
            if (!pending) setConfirmOpen(open);
          }}
        >
          <DialogContent className="max-w-md" showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              {confirm.description ? <DialogDescription>{confirm.description}</DialogDescription> : null}
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              {/* Lives in a portal, so it targets the form by id. */}
              <Button
                type="submit"
                form={formId}
                variant={confirm.destructive ? "destructive" : "default"}
                disabled={pending}
                aria-busy={pending || undefined}
              >
                {spinner}
                {confirm.confirmText ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
