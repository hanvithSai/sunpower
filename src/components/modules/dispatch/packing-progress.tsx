/**
 * Packing progress for one order: serials scanned and bulk lines ticked, as a
 * bar plus words. Server-safe; used in the dispatch queue and on the bench.
 */
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type PackingProgressValue = {
  serialRequired: number;
  serialScanned: number;
  bulkLines: number;
  bulkPicked: number;
  complete: boolean;
};

export function PackingProgress({ progress, className }: { progress: PackingProgressValue; className?: string }) {
  const total = progress.serialRequired + progress.bulkLines;
  const done = progress.serialScanned + progress.bulkPicked;
  const pct = total ? Math.round((done / total) * 100) : 100;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Progress value={pct} aria-label={`Packed ${pct}%`} indicatorClassName={progress.complete ? "bg-success" : undefined} />
      <p className="text-xs text-muted-foreground tabular-nums">
        {progress.serialScanned}/{progress.serialRequired} serials · {progress.bulkPicked}/{progress.bulkLines} bulk lines
      </p>
    </div>
  );
}
