/**
 * Public warranty lookup (F20): homeowners check their cover without calling
 * support.
 *
 *   by serial  the unit on the label, plus the workmanship warranty of the
 *              installation it belongs to
 *   by phone   the mobile number on file plus the last 4 characters of any
 *              serial on that roof (a second factor, so a phone number alone
 *              reveals nothing); returns every unit at that customer
 *
 * Only units that reached a customer are found. The answer never carries a
 * phone, an address or a full name ("L. N****, Kukatpally"), and every miss
 * returns null so the page shows one "No match found" message for all of them.
 */
import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/lib/constants";
import { maskName } from "@/lib/format";
import type { WarrantyLookupInput } from "@/lib/validation/warranty";
import { getWarrantyInfo } from "@/lib/warranty";
import { connectDB } from "../db";
import { Customer, Order, SerialUnit } from "../models";
import { workmanshipEnd } from "./tickets";

const AT_CUSTOMER = ["dispatched", "installed", "replaced"] as const;

export type PublicWarrantyUnit = {
  serial: string;
  productName: string;
  category: string;
  deliveredAt?: Date;
  endsAt?: Date;
  state: "in_warranty" | "out_of_warranty" | "not_started" | "replaced";
  label: string;
};

export type PublicWarranty = {
  customer: string;
  units: PublicWarrantyUnit[];
  workmanship?: { endsAt: Date; state: "in_warranty" | "out_of_warranty"; label: string };
};

type UnitRow = {
  serial: string;
  productName: string;
  category: ProductCategory;
  status: string;
  orderId?: unknown;
  deliveredAt?: Date;
  warrantyStartAt?: Date;
  warrantyEndAt?: Date;
  replacedBySerial?: string;
};

function toPublicUnit(u: UnitRow, now: Date): PublicWarrantyUnit {
  const base = { serial: u.serial, productName: u.productName, category: PRODUCT_CATEGORY_LABELS[u.category], deliveredAt: u.deliveredAt, endsAt: u.warrantyEndAt };
  if (u.status === "replaced") return { ...base, state: "replaced", label: u.replacedBySerial ? `Replaced by ${u.replacedBySerial}` : "Replaced" };
  if (!u.warrantyEndAt) return { ...base, state: "not_started", label: "Starts on delivery" };
  const info = getWarrantyInfo(u.warrantyStartAt, u.warrantyEndAt, now);
  return { ...base, state: info.state === "in_warranty" ? "in_warranty" : "out_of_warranty", label: info.label };
}

export async function lookupWarranty(input: WarrantyLookupInput, now: Date): Promise<PublicWarranty | null> {
  await connectDB();
  const select = "serial productName category status orderId customerId deliveredAt warrantyStartAt warrantyEndAt replacedBySerial";

  let customerId: unknown;
  let units: (UnitRow & { customerId?: unknown })[];
  if (input.by === "serial") {
    const unit = await SerialUnit.findOne({ serial: input.serial, status: { $in: AT_CUSTOMER }, customerId: { $exists: true } }).select(select).lean();
    if (!unit) return null;
    customerId = unit.customerId;
    units = [unit];
  } else {
    const customer = await Customer.findOne({ phone: input.phone }).select("_id").lean();
    if (!customer) return null;
    units = await SerialUnit.find({ customerId: customer._id, status: { $in: AT_CUSTOMER } }).select(select).sort({ category: 1, serial: 1 }).lean();
    if (!units.some((u) => u.serial.endsWith(input.last4!))) return null;
    customerId = customer._id;
  }

  const orderIds = [...new Set(units.flatMap((u) => (u.orderId ? [String(u.orderId)] : [])))];
  const [customer, orders] = await Promise.all([
    Customer.findById(customerId).select("name address.city").lean(),
    Order.find({ _id: { $in: orderIds }, commissionedAt: { $exists: true } }).select("lines commissionedAt").sort({ commissionedAt: -1 }).lean(),
  ]);
  if (!customer) return null;

  const end = orders.map((o) => workmanshipEnd(o)).find(Boolean);
  const workmanship = end
    ? (() => {
        const info = getWarrantyInfo(new Date(0), end, now);
        return { endsAt: end, state: info.state === "in_warranty" ? ("in_warranty" as const) : ("out_of_warranty" as const), label: info.label };
      })()
    : undefined;

  return {
    customer: `${maskName(customer.name)}, ${customer.address.city}`,
    units: units.map((u) => toPublicUnit(u, now)),
    workmanship,
  };
}
