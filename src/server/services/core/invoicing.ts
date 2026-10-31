/**
 * Issue a GST tax invoice. Shared by:
 *   - dispatch/delivery (sale invoice for an order),
 *   - service tickets resolved out of warranty (parts + labour),
 * so numbering, tax maths and the audit entry are identical everywhere.
 */
import type { ClientSession, Types } from "mongoose";
import { COMPANY, type InvoiceType } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { computeLine, summarize } from "@/lib/gst";
import { formatINR } from "@/lib/money";
import { Customer } from "../../models/crm";
import { Invoice, type IInvoice } from "../../models/finance";
import { notFoundError } from "../../errors";
import { toObjectId, type Actor } from "../../lib/actor";
import { logActivity } from "./activity";
import { nextInvoiceNumber } from "./counters";

export interface InvoiceLineInput {
  description: string;
  hsn: string;
  qty: number;
  unitPricePaise: number;
  gstRate: number;
}

export interface IssueInvoiceInput {
  type: InvoiceType;
  customerId: string | Types.ObjectId;
  orderId?: string | Types.ObjectId;
  ticketId?: string | Types.ObjectId;
  lines: InvoiceLineInput[];
  /** Amount already received against this invoice (e.g. order advance). */
  paidPaise?: number;
  issuedAt?: Date;
  dueInDays?: number;
  notes?: string;
  actor?: Actor | null;
}

export function invoiceStatusFor(paidPaise: number, totalPaise: number): IInvoice["status"] {
  if (paidPaise >= totalPaise) return "paid";
  if (paidPaise > 0) return "partially_paid";
  return "issued";
}

export async function issueInvoice(input: IssueInvoiceInput, session?: ClientSession): Promise<IInvoice> {
  const customer = await Customer.findById(input.customerId).session(session ?? null).lean();
  if (!customer) throw notFoundError("Customer");

  const interState = (customer.address?.state ?? COMPANY.state) !== COMPANY.state;
  const totals = summarize(input.lines, { interState });
  const issuedAt = input.issuedAt ?? new Date();
  const number = await nextInvoiceNumber(issuedAt, session);
  const paidPaise = Math.min(input.paidPaise ?? 0, totals.totalPaise);
  const a = customer.address;

  const [invoice] = await Invoice.create(
    [
      {
        number,
        type: input.type,
        customerId: customer._id,
        orderId: input.orderId ? toObjectId(input.orderId) : undefined,
        ticketId: input.ticketId ? toObjectId(input.ticketId) : undefined,
        billTo: {
          name: customer.name,
          phone: customer.phone,
          address: [a.line1, a.line2, a.city, `${a.state} ${a.pincode}`].filter(Boolean).join(", "),
          gstin: customer.gstin,
        },
        lines: input.lines.map((l) => ({ ...l, ...computeLine(l) })),
        taxablePaise: totals.taxablePaise,
        gstPaise: totals.gstPaise,
        cgstPaise: totals.cgstPaise,
        sgstPaise: totals.sgstPaise,
        igstPaise: totals.igstPaise,
        totalPaise: totals.totalPaise,
        paidPaise,
        status: invoiceStatusFor(paidPaise, totals.totalPaise),
        issuedAt,
        dueAt: addDays(issuedAt, input.dueInDays ?? 15),
        notes: input.notes,
      },
    ],
    { session },
  );

  await logActivity(
    {
      entityType: "invoice",
      entityId: invoice._id,
      customerId: customer._id,
      action: "invoice_issued",
      message: `Invoice ${number} issued for ${formatINR(totals.totalPaise)}`,
      actor: input.actor,
      at: issuedAt,
    },
    session,
  );

  return invoice.toObject();
}
