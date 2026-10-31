/**
 * Receive goods against a supplier invoice (GRN), registering a serial for
 * every serial-tracked unit.
 */
import type { Metadata } from "next";
import { GrnForm } from "@/components/modules/inventory/grn-form";
import { PageHeader } from "@/components/shared/page-header";
import { toDateInputValue } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listReceivableProducts } from "@/server/services/inventory";

export const metadata: Metadata = { title: "Receive goods" };

export default async function NewPurchasePage() {
  await requireUser(["warehouse"]);
  const products = await listReceivableProducts();
  const today = toDateInputValue(new Date());

  return (
    <>
      <PageHeader
        title="Receive goods"
        description="Record a supplier delivery. Serial-tracked items need one serial per unit."
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Goods receipts", href: "/inventory/purchases" },
          { label: "New" },
        ]}
      />
      <GrnForm products={products} today={today} />
    </>
  );
}
