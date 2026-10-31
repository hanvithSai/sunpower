/**
 * Customers are deduplicated by mobile number — the key support uses to find
 * someone in seconds. Every enquiry creates or reuses a customer here, so the
 * whole history (quotes, orders, serials, tickets) hangs off one record.
 */
import type { ClientSession } from "mongoose";
import type { CustomerType } from "@/lib/constants";
import { Customer, type ICustomer } from "../models";

export type CustomerContact = {
  name: string;
  phone: string;
  email?: string;
  city: string;
  pincode: string;
  addressLine?: string;
  customerType?: CustomerType;
};

/** DISCOM by service area: TSNPDCL covers north Telangana, TSSPDCL the south incl. Hyderabad. */
const NORTH_DISCOM_CITIES = /warangal|hanamkonda|karimnagar|nizamabad|khammam|adilabad|mancherial|jagtial|peddapalli|kamareddy|siddipet/i;

export function discomForCity(city: string): "TSSPDCL" | "TSNPDCL" {
  return NORTH_DISCOM_CITIES.test(city) ? "TSNPDCL" : "TSSPDCL";
}

export async function upsertCustomerByPhone(
  input: CustomerContact,
  session?: ClientSession,
): Promise<{ customer: ICustomer; created: boolean }> {
  const existing = await Customer.findOne({ phone: input.phone }).session(session ?? null);
  if (existing) {
    // Keep the original record; only fill gaps (e.g. an email given on a later enquiry).
    if (input.email && !existing.email) {
      existing.email = input.email;
      await existing.save({ session });
    }
    return { customer: existing.toObject(), created: false };
  }

  const [customer] = await Customer.create(
    [
      {
        name: input.name,
        phone: input.phone,
        email: input.email,
        type: input.customerType ?? "residential",
        address: {
          line1: input.addressLine || input.city,
          city: input.city,
          state: "Telangana",
          pincode: input.pincode,
        },
        discom: discomForCity(input.city),
      },
    ],
    { session },
  );
  return { customer: customer.toObject(), created: true };
}
