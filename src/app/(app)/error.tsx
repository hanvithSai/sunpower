"use client";

/**
 * Error boundary for signed-in pages. The sidebar and top bar stay usable; only the
 * page area is replaced with a friendly message.
 *
 * Next.js 16.3+ passes `retry` (re-fetches the segment from the server and re-renders,
 * the right choice for failed data loads) alongside `reset` (only clears the error state).
 * "Try again" uses `retry`. In production, server error messages are hidden; the `digest`
 * matches the server log entry, so we show it as a support reference.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { captureClientError } from "@/lib/analytics-client";

type AppErrorProps = {
  error: unknown;
  retry: () => void;
  reset: () => void;
};

export default function AppError({ error, retry }: AppErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    captureClientError(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="grid size-14 place-items-center rounded-2xl bg-danger/10 text-danger-foreground">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page couldn’t finish loading. Your data is safe — please try again. If it keeps happening, share the
        reference below with your administrator.
      </p>
      {digest ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Reference <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">{digest}</code>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </div>
  );
}
