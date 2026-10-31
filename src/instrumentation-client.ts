/**
 * Runs before the app becomes interactive. Browser analytics (PostHog) starts
 * only with the visitor's consent (src/lib/consent.ts): straight away when
 * they accepted on an earlier visit, otherwise when they click Accept in the
 * cookie banner. Withdrawing consent stops it and clears what it stored.
 * Configuration and privacy safeguards: src/lib/analytics-client.ts.
 */
import { onConsentChange, readConsent } from "@/lib/consent";
import { startAnalytics, stopAnalytics } from "@/lib/analytics-client";

if (readConsent() === "granted") startAnalytics();

onConsentChange((status) => {
  if (status === "granted") startAnalytics();
  else if (status === "denied") stopAnalytics();
});
