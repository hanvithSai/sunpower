/**
 * Server instrumentation. Unhandled errors in pages, route handlers, server
 * actions and the proxy are reported to PostHog as `$exception`, with the
 * path scrubbed of personal data (product/Analytics.md §2). A no-op without
 * NEXT_PUBLIC_POSTHOG_KEY.
 */
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  const { captureServerError } = await import("./server/analytics");
  await captureServerError(error, {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
