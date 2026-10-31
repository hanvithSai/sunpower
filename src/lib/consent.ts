/**
 * Cookie consent (product/Analytics.md §3). Analytics is strictly opt-in:
 * PostHog isn't even started until the visitor accepts, so nothing is stored
 * on the device and nothing is sent to PostHog before that.
 *
 *   granted   accepted analytics cookies (PostHog runs)
 *   denied    rejected, or the browser sends Global Privacy Control / Do Not
 *             Track and no choice was made (treated as a rejection, no banner)
 *   pending   no choice yet: the banner asks
 *
 * The choice is one essential localStorage item, versioned: raising
 * CONSENT_VERSION (for example when the analytics purposes change) asks
 * everyone again. A choice is kept for CONSENT_MAX_AGE_DAYS, then asked again.
 */
export const CONSENT_KEY = "sunpower_consent";
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_DAYS = 365;

export type ConsentChoice = "granted" | "denied";
export type ConsentStatus = ConsentChoice | "pending";
export type ConsentRecord = { v: number; analytics: ConsentChoice; at: string };

const CHANGE_EVENT = "sunpower:consent-change";
const OPEN_EVENT = "sunpower:consent-open";
const DAY_MS = 86_400_000;

/** Pure: what a stored record (or its absence) means today. */
export function consentStatus(raw: string | null, now: Date, privacySignal: boolean): ConsentStatus {
  if (raw) {
    try {
      const record = JSON.parse(raw) as Partial<ConsentRecord>;
      const at = typeof record.at === "string" ? Date.parse(record.at) : NaN;
      const fresh = Number.isFinite(at) && now.getTime() - at < CONSENT_MAX_AGE_DAYS * DAY_MS;
      if (record.v === CONSENT_VERSION && fresh && (record.analytics === "granted" || record.analytics === "denied")) return record.analytics;
    } catch {
      // Unreadable: ask again.
    }
  }
  return privacySignal ? "denied" : "pending";
}

export function consentRecord(choice: ConsentChoice, now: Date): ConsentRecord {
  return { v: CONSENT_VERSION, analytics: choice, at: now.toISOString() };
}

/* ------------------------------ Browser ------------------------------ */

/** Global Privacy Control or Do Not Track: an automatic "no" to analytics. */
function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function readConsent(): ConsentStatus {
  if (typeof window === "undefined") return "pending";
  return consentStatus(readRaw(), new Date(), privacySignal());
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consentRecord(choice, new Date())));
  } catch {
    // Private mode or storage full: the choice holds for this page only.
  }
  window.dispatchEvent(new CustomEvent<ConsentStatus>(CHANGE_EVENT, { detail: choice }));
}

/** Calls back with the new status whenever the choice changes (this tab or another). */
export function onConsentChange(callback: (status: ConsentStatus) => void): () => void {
  const local = (e: Event) => callback((e as CustomEvent<ConsentStatus>).detail);
  const other = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY) callback(readConsent());
  };
  window.addEventListener(CHANGE_EVENT, local);
  window.addEventListener("storage", other);
  return () => {
    window.removeEventListener(CHANGE_EVENT, local);
    window.removeEventListener("storage", other);
  };
}

/** "Cookie settings" links: reopen the banner to change the choice. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentSettingsOpen(callback: () => void): () => void {
  window.addEventListener(OPEN_EVENT, callback);
  return () => window.removeEventListener(OPEN_EVENT, callback);
}
