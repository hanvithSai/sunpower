/**
 * Server-side product analytics (PostHog). Business events are captured on
 * the server so they are recorded even if the browser blocks trackers.
 * Sending happens in `after()` — after the response — so it never slows a user
 * action. Without NEXT_PUBLIC_POSTHOG_KEY this is a no-op (local dev, tests, seed).
 * Event names and properties are the contract in src/lib/analytics.ts
 * (documented in product/Analytics.md).
 */
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { scrubUrl, type AnalyticsProps, type ServerEvent } from "@/lib/analytics";

let client: PostHog | null | undefined;

function newClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  return key
    ? new PostHog(key, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      })
    : null;
}

function getClient(): PostHog | null {
  if (client === undefined) client = newClient();
  return client;
}

/**
 * Capture a business event. `distinctId` is the acting user's internal id;
 * public-form events use "system" and never create a person profile.
 */
export function trackServer<E extends ServerEvent>(event: E, properties: AnalyticsProps[E], distinctId = "system"): void {
  const posthog = getClient();
  if (!posthog) return;

  // captureImmediate resolves only once the event is sent, so after() keeps a
  // serverless function alive until then (capture + flush can return early).
  const send = async () => {
    try {
      await posthog.captureImmediate({
        distinctId,
        event,
        properties: distinctId === "system" ? { ...properties, $process_person_profile: false } : properties,
      });
    } catch (error) {
      console.warn("[analytics] capture failed", error);
    }
  };

  try {
    after(send);
  } catch {
    // Outside a request (scripts): fire and forget.
    void send();
  }
}

/**
 * Report an unhandled server error as `$exception` (called from
 * onRequestError in src/instrumentation.ts). The path is scrubbed like every
 * other URL. posthog-node's captureExceptionImmediate resolves before the
 * event is sent, so a short-lived client is shut down instead: shutdown()
 * waits until everything queued has gone.
 */
export async function captureServerError(
  error: unknown,
  where: { path: string; method: string; routePath: string; routeType: string },
): Promise<void> {
  const posthog = newClient();
  if (!posthog) return;
  try {
    posthog.captureException(error, "system", {
      $process_person_profile: false,
      path: scrubUrl(where.path),
      method: where.method,
      routePath: where.routePath,
      routeType: where.routeType,
      digest: typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined,
    });
    await posthog.shutdown();
  } catch (reportError) {
    console.warn("[analytics] exception capture failed", reportError);
  }
}
