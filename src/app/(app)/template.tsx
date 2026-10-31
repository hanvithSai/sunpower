/**
 * Re-created by Next.js on every navigation between this group's pages, which
 * is what lets PageTransition animate the old page out and the new one in.
 */
import type { ReactNode } from "react";
import { PageTransition } from "@/components/shared/page-transition";

export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
