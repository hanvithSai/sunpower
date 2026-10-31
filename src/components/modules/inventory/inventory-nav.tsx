/**
 * Sub-navigation shared by the three inventory screens: stock levels, the
 * serial-number register and goods receipts. Plain links; server-safe.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "stock", label: "Stock", href: "/inventory" },
  { key: "serials", label: "Serial register", href: "/inventory/serials" },
  { key: "purchases", label: "Goods receipts", href: "/inventory/purchases" },
] as const;

export function InventoryNav({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return (
    <nav aria-label="Inventory" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            item.key === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
