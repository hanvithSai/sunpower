/**
 * Instant loading state for any signed-in page while its data streams in.
 * Modules can add a more specific loading.tsx (e.g. DetailSkeleton) in their own folder.
 */
import { PageSkeleton } from "@/components/shared/skeletons";

export default function AppLoading() {
  return <PageSkeleton />;
}
