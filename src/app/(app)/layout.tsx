/**
 * Layout for every signed-in page (dashboard, leads, inventory, service …).
 *
 * With Cache Components the session read is request-time data, so it must sit behind
 * <Suspense>: the layout itself never awaits. The static ShellSkeleton is prerendered and
 * shown instantly; AuthedShell then reads the user (redirecting to /login when signed out)
 * and streams in the real AppShell. Pages still guard themselves with requireUser(roles).
 */
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { requireUser } from "@/server/auth/session";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}

async function AuthedShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // Pass only plain, serialisable fields across the server → client boundary.
  return (
    <AppShell user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>{children}</AppShell>
  );
}
