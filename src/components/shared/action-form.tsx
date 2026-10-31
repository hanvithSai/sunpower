"use client";

/**
 * ActionForm — the standard way to post a form to a Server Action.
 *
 *   <ActionForm action={createLead} successMessage="Enquiry saved" resetOnSuccess>
 *     <FormField label="Customer name" name="name" required>
 *       <Input id="name" name="name" />
 *     </FormField>
 *     <SubmitButton pendingText="Saving…">Save enquiry</SubmitButton>
 *   </ActionForm>
 *
 * - Runs the action through `useActionState`, so `<SubmitButton>` shows a pending state.
 * - Toasts the result: `state.message ?? successMessage` on success, `state.message` on error.
 * - Exposes per-field errors to <FormField> via context (`useFieldError(name)`).
 * - Keeps what the user typed when validation fails. React 19 resets a form after every
 *   `action` submission; we intercept submit and dispatch inside a transition instead,
 *   which keeps the pending state but skips that automatic reset. `resetOnSuccess` clears
 *   the form only after a successful save.
 * - `redirect()` / `notFound()` thrown by the action still work; unexpected errors become an
 *   error toast instead of taking down the page.
 */
import { createContext, startTransition, useActionState, useContext, useRef, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import type { ActionState, FormAction } from "@/lib/action-state";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ------------------------------------------------------------------ */
/* Helpers shared with <ActionButton>                                   */
/* ------------------------------------------------------------------ */

/** Run a Server Action, letting Next.js navigation errors through and turning crashes into a failed state. */
export async function runFormAction(action: FormAction, prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    return await action(prev, formData);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[ActionForm] action failed", error);
    return { ok: false, message: GENERIC_ERROR };
  }
}

/** Show the toast for an action result. */
export function toastActionResult(state: ActionState, successMessage?: string) {
  if (!state) return;
  if (state.ok) {
    const message = state.message ?? successMessage;
    if (message) toast.success(message);
    return;
  }
  const hasFieldErrors = Boolean(state.fieldErrors && Object.keys(state.fieldErrors).length > 0);
  toast.error(state.message ?? (hasFieldErrors ? "Please fix the highlighted fields." : GENERIC_ERROR));
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

type ActionFormContextValue = {
  /** The latest result returned by the action (null before the first submit). */
  state: ActionState;
  /** True while the action is running. */
  pending: boolean;
};

const ActionFormContext = createContext<ActionFormContextValue>({ state: null, pending: false });

/** The surrounding ActionForm's latest result and pending flag. */
export function useActionFormState(): ActionFormContextValue {
  return useContext(ActionFormContext);
}

/** The server-side validation message for one field, if any. */
export function useFieldError(name: string): string | undefined {
  const { state } = useContext(ActionFormContext);
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[name];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type ActionFormProps = {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Toast shown on success when the action doesn't return its own `message`. */
  successMessage?: string;
  /** Clear the fields after a successful submit (useful for "add another" forms). */
  resetOnSuccess?: boolean;
  /** Called after a successful submit, e.g. to close a dialog or navigate. */
  onSuccess?: (state: ActionState) => void;
  /** Form id, so buttons outside the form can submit it with `form={id}`. */
  id?: string;
};

export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  onSuccess,
  id,
}: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const next = await runFormAction(action, prev, formData);
    toastActionResult(next, successMessage);
    if (next?.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(next);
    }
    return next;
  }, null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Dispatch ourselves (inside a transition) so React skips its automatic form reset.
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <ActionFormContext value={{ state, pending }}>
      <form
        ref={formRef}
        id={id}
        action={formAction}
        onSubmit={handleSubmit}
        className={className}
        aria-busy={pending || undefined}
      >
        {children}
      </form>
    </ActionFormContext>
  );
}
