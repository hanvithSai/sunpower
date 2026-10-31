/**
 * Browser analytics (PostHog), started before the app becomes interactive.
 * Off without NEXT_PUBLIC_POSTHOG_KEY (local development, CI, previews).
 *
 * Privacy (product/Analytics.md §3): no click autocapture, so `tel:` and
 * `wa.me` links never leave the page as events; anonymous visitors get no
 * person profile and are never recorded (replay starts only after a staff
 * sign-in, see identifyStaff); every URL is scrubbed of share tokens and
 * search text; replay masks inputs, phone numbers, emails and GSTINs, and
 * blocks `.ph-no-capture` elements (contact cards, the signature pad).
 */
import posthog, { type CaptureResult } from "posthog-js";
import { maskContactText, scrubProperties, scrubUrl } from "@/lib/analytics";

/** rrweb's meta event (type 4) carries the page URL of a replay. */
function scrubReplayUrls(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((e) =>
    e && typeof e === "object" && e.type === 4 && typeof e.data?.href === "string" ? { ...e, data: { ...e.data, href: scrubUrl(e.data.href) } } : e,
  );
}

function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  event.properties = scrubProperties(event.properties);
  if (event.$set) event.$set = scrubProperties(event.$set);
  if (event.$set_once) event.$set_once = scrubProperties(event.$set_once);
  if (event.event === "$snapshot" && event.properties) {
    event.properties.$snapshot_data = scrubReplayUrls(event.properties.$snapshot_data);
  }
  return event;
}

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      defaults: "2026-01-30",
      capture_pageview: "history_change",
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_performance: false,
      enable_heatmaps: false,
      disable_surveys: true,
      capture_exceptions: true,
      person_profiles: "identified_only",
      respect_dnt: true,
      disable_session_recording: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        maskTextFn: maskContactText,
        maskAttributeFn: (_name, value) => maskContactText(value),
        maskCapturedNetworkRequestFn: (request) => ({ ...request, name: scrubUrl(request.name) }),
      },
      before_send: beforeSend,
    });
  } catch (error) {
    console.warn("[analytics] PostHog failed to start", error);
  }
}
