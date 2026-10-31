"use client";

/**
 * Staff sign-in form.
 *
 * - Posts `email`, `password` and a hidden, sanitised `callbackUrl` (from ?callbackUrl=) to
 *   the `loginAction` Server Action through useActionState. On success the action redirects
 *   to the right home for the user's role.
 * - Field errors show inline under each input; every failure also raises a toast.
 * - Inputs are controlled, so React's post-submit form reset never wipes what was typed.
 * - "Demo accounts" fills the form in one click for the hackathon demo.
 * Must render inside <Suspense> (it reads useSearchParams()).
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/actions/auth";

const DEMO_PASSWORD = "SunPower@2026";

const DEMO_ACCOUNTS = [
  { role: "Director", email: "director@sunpower.demo", scope: "Everything, incl. dashboard and payroll" },
  { role: "Sales", email: "sales@sunpower.demo", scope: "Leads, surveys, quotes and orders" },
  { role: "Technician", email: "tech@sunpower.demo", scope: "My work, installations and service visits" },
  { role: "Warehouse", email: "warehouse@sunpower.demo", scope: "Stock, goods receipts and dispatch" },
  { role: "Support", email: "support@sunpower.demo", scope: "⌘K search, tickets and warranty" },
] as const;

/** Only same-site relative paths are allowed as post-login destinations. */
function safeCallbackUrl(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [state, formAction, pending] = useActionState(loginAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const announced = useRef<ActionState>(null);

  // Toast each new result once. (A successful sign-in normally redirects before this runs.)
  useEffect(() => {
    if (!state || state === announced.current) return;
    announced.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Signed in");
      router.refresh();
    } else {
      toast.error(state.message ?? "We couldn’t sign you in. Please try again.");
    }
  }, [state, router]);

  const failed = state !== null && !state.ok;
  const fieldErrors = failed ? (state.fieldErrors ?? {}) : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const formError = failed && !hasFieldErrors ? state.message : undefined;

  function pickAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    submitRef.current?.focus();
  }

  return (
    <div className="mt-8 space-y-8">
      <form action={formAction} className="space-y-5" aria-describedby={formError ? "login-error" : undefined}>
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

        <div className="grid gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@sunpower.demo"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="h-11"
          />
          {fieldErrors.email ? (
            <p id="email-error" className="text-[13px] text-danger-foreground">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="password"
              className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="password-error" className="text-[13px] text-danger-foreground">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {formError ? (
          <div
            id="login-error"
            role="alert"
            className="flex items-start gap-2.5 rounded-lg bg-danger/10 px-3.5 py-3 text-[13px] text-danger-foreground"
          >
            <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        ) : null}

        <Button ref={submitRef} type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <section aria-labelledby="demo-accounts-title" className="rounded-xl border border-border bg-muted/50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="demo-accounts-title" className="text-[13px] font-semibold text-foreground">
            Demo accounts
          </h2>
          <p className="text-xs text-muted-foreground">
            Password <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground">{DEMO_PASSWORD}</code>
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Pick a role to fill the form, then press Sign in.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => {
            const selected = email === account.email;
            return (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => pickAccount(account.email)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full flex-col items-start rounded-lg border bg-card px-3 py-2.5 text-left transition-[border-color,box-shadow,background-color] duration-150",
                    selected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-input hover:shadow-sm",
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{account.role}</span>
                  <span className="w-full truncate text-xs text-muted-foreground">{account.email}</span>
                  <span className="sr-only">{account.scope}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
