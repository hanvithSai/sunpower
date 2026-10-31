"use client";

/**
 * Last line of defence: an error in the root layout itself. This replaces the
 * whole document, so it brings its own <html>, <body> and inline styles (the
 * app's stylesheet and fonts aren't loaded here). The error goes to PostHog
 * like any other caught error; `retry` re-renders the root from the server.
 */
import { useEffect } from "react";
import { captureClientError } from "@/lib/analytics-client";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    captureClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f3f5f0", color: "#18261f", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <title>SunPower is unavailable</title>
        <main role="alert" style={{ maxWidth: 420, padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>We couldn’t load SunPower</h1>
          <p style={{ fontSize: 14, color: "#536158", margin: "8px 0 24px" }}>This is usually a brief network or database hiccup. Your data is safe — please try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 8, background: "#1d5c40", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
