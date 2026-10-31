"use client";

/**
 * Mobile navigation: the hamburger in the top bar (below the `lg` breakpoint) opens a
 * left sheet with the same role-filtered navigation and user card as the desktop sidebar.
 * The sheet closes itself when a link is chosen.
 */
import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { roleHome } from "@/lib/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav, SidebarUserCard } from "@/components/shell/sidebar-nav";
import type { SessionUser } from "@/server/auth/session";

export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open navigation">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="gap-0 p-0">
        <SheetHeader className="h-14 shrink-0 justify-center border-b border-border px-5 py-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages available to your role.</SheetDescription>
          <Link href={roleHome(user.role)} onClick={close} className="w-fit rounded-lg" aria-label="SunPower OS home">
            <Logo size="sm" />
          </Link>
        </SheetHeader>
        <SidebarNav role={user.role} onNavigate={close} className="flex-1 overflow-y-auto px-3 py-4" />
        <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <SidebarUserCard user={user} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
