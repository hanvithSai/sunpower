/**
 * Where an order is on its way from payment to commissioning.
 */
import { Check, XCircle } from "lucide-react";
import { statusMeta, type OrderStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ORDER_STEPS } from "@/lib/workflows";

export function OrderStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/8 p-4 text-sm font-medium">
        <XCircle className="size-5 text-danger-foreground" aria-hidden="true" />
        This order was cancelled.
      </div>
    );
  }
  const current = ORDER_STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                done && "bg-success/12 text-success-foreground",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" aria-hidden="true" /> : null}
              {statusMeta("order", step).label}
            </span>
            {i < ORDER_STEPS.length - 1 ? <span className="h-px w-3 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
