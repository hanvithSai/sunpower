"use client";

/**
 * "Share these numbers": create an expiring read-only link (customer names
 * masked on the shared view), copy it, revoke it, and download CSVs.
 */
import { useState } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { CopyButton } from "@/components/shared/copy-button";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createShareLinkAction, revokeShareLinkAction } from "@/server/actions/finance";

type LinkRow = { id: string; token: string; label?: string; expiresAt: Date | string; viewCount: number; state: "active" | "expired" | "revoked" };

export function SharePanel({ links, range, month }: { links: LinkRow[]; range: string; month: string }) {
  // Dialog content only mounts in the browser after opening, so the origin is always known there.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [created, setCreated] = useState<string | null>(null);
  const active = links.filter((l) => l.state === "active");

  return (
    <Dialog onOpenChange={(open) => !open && setCreated(null)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 aria-hidden="true" />
          Share &amp; export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share these numbers</DialogTitle>
          <DialogDescription>A read-only link anyone can open without signing in. Customer names are masked; it stops working on expiry or when revoked.</DialogDescription>
        </DialogHeader>

        <ActionForm
          action={createShareLinkAction}
          onSuccess={(state) => {
            const token = state?.data?.token;
            if (typeof token === "string") setCreated(`${origin}/share/${token}`);
          }}
          className="grid grid-cols-[1fr_120px_auto] items-end gap-2"
        >
          <FormField label="For" name="label">
            <Input id="label" name="label" maxLength={80} placeholder="Auditor, investor…" />
          </FormField>
          <FormField label="Valid for" name="days">
            <Select id="days" name="days" defaultValue="7">
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} day{d === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </FormField>
          <SubmitButton pendingText="Creating…">
            <Link2 aria-hidden="true" />
            Create
          </SubmitButton>
        </ActionForm>

        {created ? (
          <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/8 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{created}</code>
            <CopyButton value={created} />
          </div>
        ) : null}

        {active.length ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Active links</p>
            <ul className="space-y-2">
              {active.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{l.label || "Untitled link"}</span>
                    <span className="block text-xs text-muted-foreground">
                      Expires {new Date(l.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · {l.viewCount} view{l.viewCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <CopyButton value={`${origin}/share/${l.token}`} />
                    <ActionButton action={revokeShareLinkAction} hiddenFields={{ shareLinkId: l.id }} variant="ghost" size="sm" confirm={{ title: "Revoke this link?", description: "Anyone using it loses access immediately.", confirmText: "Revoke", destructive: true }}>
                      Revoke
                    </ActionButton>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : links.length ? (
          <p className="text-xs text-muted-foreground">
            <Badge variant="neutral">{links.length}</Badge> older links have expired or been revoked.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/v1/reports/profit?range=${range}`} download>
              <Download aria-hidden="true" />
              Profit per job (CSV)
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/v1/reports/payroll?month=${month}`} download>
              <Download aria-hidden="true" />
              Technician payroll (CSV)
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
