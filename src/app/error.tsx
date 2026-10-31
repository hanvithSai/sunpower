"use client";

/**
 * Last-resort error boundary for anything below the root layout — including
 * errors thrown inside the route-group layouts themselves (e.g. a database
 * outage while the app shell reads the session), which their own error.tsx
 * cannot catch. `retry` re-fetches the segment from the server (Next 16.3+).
 */
import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type RootErrorProps = {
  error: unknown;
  retry: () => void;
  reset: () => void;
};

export default function RootError({ error, retry }: RootErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main role="alert" className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-danger/10 text-danger-foreground">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">We couldn’t load SunPower OS</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is usually a brief network or database hiccup. Your data is safe — please try again.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <Button asChild variant="outline">
          <Link href="/">Go to home</Link>
        </Button>
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </main>
  );
}
