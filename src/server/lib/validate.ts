/**
 * Input parsing shared by Server Actions and route handlers.
 * `parseInput` throws an AppError("VALIDATION") carrying per-field messages,
 * which <ActionForm> shows under each input.
 */
import type { z } from "zod";
import { AppError } from "../errors";

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new AppError("VALIDATION", "Please fix the highlighted fields.", fieldErrors);
}

/**
 * FormData -> plain object. Repeated keys (multiple hidden `photos` inputs,
 * multi-selects) become arrays; Next's internal `$ACTION_*` keys are dropped.
 */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value : value;
    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, v] : [existing, v];
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Parse a FormData straight into a schema. */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.output<S> {
  return parseInput(schema, formToObject(formData));
}
