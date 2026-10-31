/**
 * Server-side product analytics (PostHog). Business events are captured on
 * the server so they are recorded even if the browser blocks trackers.
 * Sending happens in `after()` — after the response — so it never slows a user
 * action. Without NEXT_PUBLIC_POSTHOG_KEY this is a no-op (local dev, tests, seed).
 * Event names are documented in product/Analytics.md.
 */
import { after } from "next/server";
import { PostHog } from "posthog-node";
import type { AnalyticsEvent } from "@/lib/constants";

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  client = key
    ? new PostHog(key, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      })
    : null;
  return client;
}

/**
 * Capture a business event. `distinctId` should be the internal user id —
 * never put customer phone numbers or emails in properties.
 */
export function trackServer(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
  distinctId = "system",
): void {
  const posthog = getClient();
  if (!posthog) return;

  const send = async () => {
    try {
      posthog.capture({ distinctId, event, properties: { ...properties, source: "server" } });
      await posthog.flush();
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
