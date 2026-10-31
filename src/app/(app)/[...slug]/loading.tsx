/**
 * Route-level Suspense boundary: with Cache Components and Partial
 * Prefetching, a page that reads the session needs its own boundary below the
 * shared app layout so client navigations into it render instantly.
 */
import { PageSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return <PageSkeleton />;
}
