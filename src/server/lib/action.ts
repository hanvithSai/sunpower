/**
 * Wrapper for every mutating Server Action:
 *   export async function qualifyLead(prev: ActionState, fd: FormData) {
 *     return runAction(["sales"], async (user) => { ...; return { ok: true, message: "Lead qualified" }; });
 *   }
 * It authenticates, authorises by role (admin always allowed), connects to the
 * DB and converts thrown errors into an ActionState the form can display.
 * `redirect()` / `notFound()` thrown inside still work (unstable_rethrow).
 */
import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import type { Role } from "@/lib/constants";
import { canAccess } from "@/lib/navigation";
import { getCurrentUser, type SessionUser } from "../auth/session";
import { connectDB } from "../db";
import { AppError, isDuplicateKeyError } from "../errors";

export async function runAction(
  roles: readonly Role[] | "any",
  work: (user: SessionUser) => Promise<ActionState>,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Your session has expired — please sign in again." };
    if (roles !== "any" && !canAccess(user.role, roles)) {
      return { ok: false, message: "You don't have permission to do that." };
    }
    await connectDB();
    return await work(user);
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export function toActionError(error: unknown): ActionState {
  if (error instanceof AppError) {
    return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (isDuplicateKeyError(error)) {
    return { ok: false, message: "A record with these details already exists." };
  }
  console.error("[action] unexpected error", error);
  return { ok: false, message: "Something went wrong. Please try again." };
}
