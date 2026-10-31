/**
 * Data Access Layer entry point for "who is signed in".
 *
 * Call `requireUser([...roles])` at the top of every page / data loader. It
 * reads the session cookie (making the render request-time, which Cache
 * Components requires before DB access or `new Date()`), redirects signed-out
 * users to /login and sends users without permission to their own home page.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";
import { canAccess, roleHome } from "@/lib/navigation";
import { auth } from "./config";

export type SessionUser = { id: string; name: string; email: string; role: Role };

/** Per-request memoised session read. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  return { id: user.id, name: user.name ?? "", email: user.email ?? "", role: user.role };
});

export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !canAccess(user.role, roles)) redirect(roleHome(user.role));
  return user;
}
