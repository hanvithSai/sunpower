/**
 * Where an order is on its way from payment to commissioning. A hardware-only
 * order (a Panel Set without the installation line) skips the installation
 * steps and closes at delivery.
 */
import { Check, XCircle } from "lucide-react";
import { statusMeta, type OrderStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ORDER_STEPS } from "@/lib/workflows";

const INSTALL_STEPS: OrderStatus[] = ["installing", "commissioned"];

export function OrderStepper({ status, hardwareOnly = false }: { status: OrderStatus; hardwareOnly?: boolean }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/8 p-4 text-sm font-medium">
        <XCircle className="size-5 text-danger-foreground" aria-hidden="true" />
        This order was cancelled.
      </div>
    );
  }
  const steps = hardwareOnly ? ORDER_STEPS.filter((s) => !INSTALL_STEPS.includes(s)) : ORDER_STEPS;
  const current = steps.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Order progress">
      {steps.map((step, i) => {
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
            {i < steps.length - 1 ? <span className="h-px w-3 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
