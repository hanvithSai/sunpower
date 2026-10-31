"use client";

/**
 * SubmitButton — a submit <Button> that disables itself and shows a spinner while its
 * form's Server Action runs. Works inside <ActionForm> or any <form action={…}>.
 *
 *   <SubmitButton pendingText="Saving…">Save</SubmitButton>
 *
 * For icon-only buttons pass screen-reader-only pending text:
 *   pendingText={<span className="sr-only">Signing out…</span>}
 */
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useActionFormState } from "@/components/shared/action-form";

export type SubmitButtonProps = Omit<ButtonProps, "asChild"> & {
  /** Label shown next to the spinner while pending. Defaults to the normal children. */
  pendingText?: ReactNode;
};

export function SubmitButton({ children, pendingText, disabled, type = "submit", ...props }: SubmitButtonProps) {
  const status = useFormStatus();
  const actionForm = useActionFormState();
  const pending = status.pending || actionForm.pending;

  return (
    <Button type={type} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
