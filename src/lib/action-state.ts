/**
 * The result every Server Action returns. Client forms read it through
 * `useActionState` (see <ActionForm>) to show toasts and per-field errors.
 */
export type ActionState = {
  ok: boolean;
  message?: string;
  /** Field name -> first error message, e.g. { phone: "Enter a valid ..." } */
  fieldErrors?: Record<string, string>;
  /** Optional payload, e.g. the id of a created record. */
  data?: Record<string, unknown>;
} | null;

export const initialActionState: ActionState = null;

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
