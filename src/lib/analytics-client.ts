/**
 * Browser analytics helpers over the PostHog instance that
 * src/instrumentation-client.ts starts. Every helper is a no-op when PostHog
 * isn't running (no key: local development, CI, previews).
 *
 * - track: the two browser events (⌘K search), typed by src/lib/analytics.ts
 * - identifyStaff: after sign-in, the internal user id and role only; starts
 *   session replay, which never runs for public visitors
 * - resetAnalytics: on sign-out, so a shared phone doesn't keep the identity
 * - captureClientError: errors caught by our error boundaries, which the
 *   SDK's automatic capture never sees
 */
import posthog from "posthog-js";
import type { AnalyticsProps, ClientEvent } from "./analytics";
import type { Role } from "./constants";

function running(): boolean {
  return typeof window !== "undefined" && posthog.__loaded;
}

export function track<E extends ClientEvent>(event: E, properties: AnalyticsProps[E]): void {
  if (running()) posthog.capture(event, properties);
}

export function identifyStaff(userId: string, role: Role): void {
  if (!running()) return;
  if (posthog.get_distinct_id() !== userId) posthog.identify(userId, { role });
  if (!posthog.sessionRecordingStarted()) posthog.startSessionRecording();
}

export function resetAnalytics(): void {
  if (!running()) return;
  posthog.stopSessionRecording();
  posthog.reset();
}

export function captureClientError(error: unknown): void {
  if (running()) posthog.captureException(error);
}
