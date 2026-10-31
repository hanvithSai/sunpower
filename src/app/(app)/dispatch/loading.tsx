/** Instant skeleton while the dispatch queue streams in (route-level Suspense boundary). */
import { PageSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return <PageSkeleton />;
}
