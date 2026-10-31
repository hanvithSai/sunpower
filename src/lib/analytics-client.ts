/**
 * Browser analytics (PostHog), only with consent (src/lib/consent.ts).
 * src/instrumentation-client.ts calls startAnalytics() when the visitor has
 * accepted and stopAnalytics() when they withdraw. Every helper is a no-op
 * while PostHog isn't running (no consent yet, rejected, or no key: local
 * development, CI, previews).
 *
 * Privacy (product/Analytics.md §3): click autocapture is fully masked (no
 * element text or attributes), so `tel:` and `wa.me` links never leave the
 * page; anonymous visitors get no person profile and are never recorded
 * (replay starts only after a staff sign-in, see identifyStaff); every URL —
 * in event properties, replay metadata, heatmap pages and web vitals — is
 * scrubbed of share tokens and search text; replay masks inputs, phone
 * numbers, emails and GSTINs, and blocks `.ph-no-capture` elements (contact
 * cards, the signature pad).
 *
 * - track: the two browser events (⌘K search), typed by src/lib/analytics.ts
 * - identifyStaff: after sign-in, the internal user id and role only; starts
 *   session replay. Remembered, so accepting cookies later still identifies.
 * - resetAnalytics: on sign-out, so a shared phone doesn't keep the identity
 * - captureClientError: errors caught by our error boundaries, which the
 *   SDK's automatic capture never sees
 */
import posthog, { type CaptureResult } from "posthog-js";
import { maskContactText, scrubHeatmapData, scrubProperties, scrubUrl, type AnalyticsProps, type ClientEvent } from "./analytics";
import type { Role } from "./constants";

/** Where PostHog remembers an opt-out; cleared before a fresh opt-in starts it. */
const OPT_OUT_KEY = "sunpower_ph_opt_out";

let staff: { userId: string; role: Role } | null = null;

function running(): boolean {
  return typeof window !== "undefined" && posthog.__loaded && posthog.is_capturing();
}

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
  if (event.properties?.$heatmap_data) event.properties.$heatmap_data = scrubHeatmapData(event.properties.$heatmap_data);
  return event;
}

function identifyNow(): void {
  if (!staff || !running()) return;
  if (posthog.get_distinct_id() !== staff.userId) posthog.identify(staff.userId, { role: staff.role });
  if (!posthog.sessionRecordingStarted()) posthog.startSessionRecording();
}

/** Start (or resume) PostHog after the visitor accepted analytics cookies. */
export function startAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return;
  try {
    if (posthog.__loaded) {
      // Accepted again in the same visit, after a rejection.
      if (!posthog.is_capturing()) posthog.opt_in_capturing({ captureEventName: false });
      identifyNow();
      return;
    }
    window.localStorage.removeItem(OPT_OUT_KEY);
    posthog.init(key, {
      // Through our own domain (next.config.ts rewrites) so ad blockers don't drop events.
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2026-01-30",
      capture_pageview: "history_change",
      // Clicks and form submits on links, buttons and forms, fully masked: no
      // element text and no attributes (so no tel:/wa.me hrefs). CTAs carry
      // their own label through cta() in src/lib/analytics.ts.
      autocapture: { dom_event_allowlist: ["click", "submit"], element_allowlist: ["a", "button", "form"] },
      mask_all_text: true,
      mask_all_element_attributes: true,
      rageclick: true,
      capture_dead_clicks: true,
      // Core Web Vitals (LCP, INP, CLS, FCP) per page; no network timing in replays.
      capture_performance: { web_vitals: true, network_timing: false },
      // Click positions and scroll depth per page; the page URLs are scrubbed in beforeSend.
      capture_heatmaps: true,
      disable_surveys: true,
      capture_exceptions: true,
      person_profiles: "identified_only",
      // Do Not Track and Global Privacy Control already count as "no" in consent.ts
      // until the visitor explicitly accepts; that explicit choice wins.
      respect_dnt: false,
      secure_cookie: true,
      // A withdrawal also stops PostHog storing anything on the device.
      opt_out_persistence_by_default: true,
      consent_persistence_name: OPT_OUT_KEY,
      disable_session_recording: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        maskTextFn: maskContactText,
        maskAttributeFn: (_name, value) => maskContactText(value),
        maskCapturedNetworkRequestFn: (request) => ({ ...request, name: scrubUrl(request.name) }),
      },
      before_send: beforeSend,
      loaded: identifyNow,
    });
  } catch (error) {
    console.warn("[analytics] PostHog failed to start", error);
  }
}

/** Remove what PostHog stored on this device (cookies and storage named ph_…). */
function clearPostHogStorage(): void {
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name?.startsWith("ph_")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const k of Object.keys(store)) if (k.startsWith("ph_") || k.startsWith("__ph")) store.removeItem(k);
  }
}

/** The visitor rejected or withdrew consent: stop, forget the identity, and clear the device. */
export function stopAnalytics(): void {
  if (typeof window === "undefined") return;
  try {
    if (posthog.__loaded) {
      posthog.stopSessionRecording();
      posthog.reset();
      posthog.opt_out_capturing();
    }
    clearPostHogStorage();
  } catch (error) {
    console.warn("[analytics] PostHog failed to stop", error);
  }
}

export function track<E extends ClientEvent>(event: E, properties: AnalyticsProps[E]): void {
  if (running()) posthog.capture(event, properties);
}

export function identifyStaff(userId: string, role: Role): void {
  staff = { userId, role };
  identifyNow();
}

export function resetAnalytics(): void {
  staff = null;
  if (!running()) return;
  posthog.stopSessionRecording();
  posthog.reset();
}

export function captureClientError(error: unknown): void {
  if (running()) posthog.captureException(error);
}
