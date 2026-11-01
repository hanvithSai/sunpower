/**
 * Day-by-day activity for the last week and today, so "Today" and "This week"
 * are never empty: each day a few enquiries, a finished installation (crew
 * hours, serials, invoice), service visits closed or awaiting the customer's
 * OK, and a balance payment collected.
 *
 * Remembers the last day it filled (`seed:daily`), so re-running the seed on
 * demo morning fills every day since — run `npm run seed -- --yes` then.
 */
import { formatINR } from "@/lib/money";
import { Types } from "mongoose";
import { LEAD_SOURCE_LABELS, type LeadSource } from "@/lib/constants";
import { Activity, Counter, Customer, Invoice, Lead, Order, Payment } from "@/server/models";
import { insertInstallations, reserve, type Spec } from "../history";
import { seededPhone } from "../people";
import { Builder, loadBase, type TicketSpec } from "./service";
import { PLACES, Timeline, addDays, addHours, customerDoc, insertOpts, ist, personName, pick, prng, reference, weighted, who, type Ctx } from "./common";

const MARKER = "seed:daily";
const istDay = (d: Date) => Math.floor((d.getTime() + 330 * 60_000) / 86_400_000);
const fromIstDay = (n: number) => new Date(n * 86_400_000 - 330 * 60_000);

export async function seedDaily(ctx: Ctx): Promise<string> {
  const now = ctx.now;
  const today = istDay(now);
  const last = (await Counter.findById(MARKER).lean())?.seq;
  const first = last === undefined ? today - 6 : last + 1;
  if (first > today) return "Daily activity: already filled up to today";
  const lines: string[] = [];
  for (let day = first; day <= today; day++) {
    lines.push(await fillDay(ctx, day, day === today));
    // Progress is saved per day, so an interrupted run never fills a day twice.
    await Counter.updateOne({ _id: MARKER }, { $set: { seq: day } }, { upsert: true });
  }
  return `Daily activity:\n  ${lines.join("\n  ")}`;
}

async function fillDay(ctx: Ctx, day: number, isToday: boolean): Promise<string> {
  const now = ctx.now;
  const start = fromIstDay(day);
  const rand = prng(90_000 + day);
  const dd = new Date(start.getTime() + 330 * 60_000).toISOString().slice(5, 10);
  const sunday = new Date(start.getTime() + 330 * 60_000).getUTCDay() === 0;
  const done: string[] = [];

  // Enquiries: today's stay new; earlier ones have been called (some qualified, one lost).
  const t = new Timeline();
  const times = [10.25, 13.6, 17.3].map((h) => ist(start, h)).filter((at) => at.getTime() < now.getTime() - 10 * 60_000);
  const [leadNos] = await Promise.all([reserve("SP-L", times.length)]);
  const customers: object[] = [];
  const leads: object[] = [];
  times.forEach((at, k) => {
    const source = weighted(rand, [["website", 4], ["whatsapp", 4], ["phone", 2], ["referral", 1], ["other", 1]] as const) as LeadSource;
    const place = pick(rand, PLACES);
    const name = personName(rand);
    const phone = seededPhone(8000 + (day % 1000) * 3 + k);
    const c = customerDoc(rand, { name, phone, place, type: "residential", at });
    const salesUser = ctx.sales[(day + k) % ctx.sales.length]!;
    const kw = pick(rand, [2, 3, 3, 4, 5]);
    const status = isToday ? "new" : k === 2 && day % 3 === 0 ? "lost" : k === 1 ? "qualified" : "contacted";
    const contactedAt = addHours(at, 0.5 + rand());
    const lead: Record<string, unknown> = {
      _id: new Types.ObjectId(),
      number: leadNos[k],
      customerId: c._id,
      name,
      phone,
      city: place.city,
      source,
      requirement: { capacityKw: kw, systemType: rand() < 0.8 ? "on_grid" : "unsure", wantsSubsidy: true, monthlyBillRs: 500 * kw + 300 },
      status,
      assignedTo: isToday && source === "website" ? undefined : salesUser._id,
      lastActivityAt: at,
      createdAt: at,
      updatedAt: at,
    };
    t.add("lead", lead._id as Types.ObjectId, c._id, "created", `Enquiry received via ${LEAD_SOURCE_LABELS[source].toLowerCase()}: ${kw} kW`, at);
    if (status !== "new") {
      Object.assign(lead, { firstContactedAt: contactedAt, lastActivityAt: contactedAt, updatedAt: contactedAt });
      t.add("lead", lead._id as Types.ObjectId, c._id, "contacted", "First call made; requirement noted", contactedAt, who(salesUser));
    }
    if (status === "qualified") {
      const qAt = addHours(contactedAt, 3);
      Object.assign(lead, { qualification: { roofAreaSqft: 200 * kw + 250, shadowFreeAreaSqft: 120 * kw + 80, monthlyBillRs: 500 * kw + 300, gridSuitable: true, roofType: "rcc", qualifiedAt: qAt, qualifiedBy: salesUser._id }, lastActivityAt: qAt, updatedAt: qAt });
      t.add("lead", lead._id as Types.ObjectId, c._id, "qualified", "Qualified: roof and bill details recorded", qAt, who(salesUser));
    }
    if (status === "lost") {
      Object.assign(lead, { lostReason: "Only checking prices for now", lastActivityAt: addHours(contactedAt, 0.1), updatedAt: addHours(contactedAt, 0.1) });
      t.add("lead", lead._id as Types.ObjectId, c._id, "lost", "Marked lost: Only checking prices for now", addHours(contactedAt, 0.1), who(salesUser));
    }
    customers.push(c);
    leads.push(lead);
  });
  if (customers.length) {
    await Customer.insertMany(customers, insertOpts);
    await Lead.insertMany(leads, insertOpts);
    done.push(`${leads.length} enquiries`);
  }

  // A finished installation (small system so it is done by mid-afternoon), if the day's work is over.
  const finishBy = ist(start, 17.5);
  // About three a week on top of the booked pipeline: every other working day.
  if (!sunday && day % 2 === 0 && finishBy.getTime() < now.getTime()) {
    const place = pick(rand, PLACES);
    const spec: Spec = {
      name: personName(rand),
      phone: seededPhone(8600 + (day % 1000)),
      place,
      area: pick(rand, place.areas),
      kw: pick(rand, [1, 2]),
      systemType: rand() < 0.85 ? "on_grid" : "off_grid",
      commissionedAt: ist(start, 9.5),
      overtimeHours: 0,
      extras: [],
      unpaidBalance: rand() < 0.5,
      subsidyRejected: false,
      source: pick(rand, ["website", "whatsapp", "referral", "phone"] as const),
    };
    await insertInstallations([spec], { now, tag: `D${dd.replace("-", "")}`, seed: 70_000 + day });
    done.push(`installation for ${spec.name}`);
  }

  // Service visits: closed on earlier days, awaiting the customer's OK on the last two.
  const base = await loadBase();
  const b = new Builder(ctx, base, rand);
  const specs: TicketSpec[] = [];
  const recentDay = istDay(now) - day <= 1;
  for (let k = 0; k < 1; k++) {
    const at = ist(start, 9.5 + (day % 3) * 2);
    const hours = 1 + k * 0.5;
    if (addHours(at, 3 + hours).getTime() > now.getTime()) continue;
    const tech = ctx.techs[(day * 2 + k) % ctx.techs.length]!;
    specs.push({ stage: recentDay ? (k ? "customer_confirmed" : "resolved") : "closed", at, tech, category: pick(rand, ["low_generation", "fault_code", "wiring_earthing", "no_power"] as const), channel: pick(rand, ["phone", "whatsapp", "portal"] as const), visitAfterH: 3, hours });
  }
  if (specs.length) {
    const [ticketNos, jobNos] = await Promise.all([reserve("SP-T", specs.length), reserve("SP-J", specs.length)]);
    specs.forEach((s, i) => b.build(s, ticketNos[i]!));
    await b.flush(ticketNos, jobNos);
    done.push(`${specs.length} service visit${specs.length === 1 ? "" : "s"}`);
  }

  // A balance collected on an installation that still owes money.
  const payAt = ist(start, 12.5);
  if (payAt.getTime() < now.getTime()) {
    const owing = await Order.findOne({ status: { $in: ["commissioned", "closed"] }, $expr: { $lt: ["$paidPaise", "$totalPaise"] }, commissionedAt: { $lt: addDays(payAt, -2) } }).sort({ commissionedAt: 1 }).lean();
    if (owing) {
      const amount = owing.totalPaise - owing.paidPaise;
      const [payNo] = await reserve("SP-PAY", 1);
      const mode = pick(rand, ["upi", "bank_transfer", "cheque"] as const);
      const salesUser = ctx.sales[day % ctx.sales.length]!;
      await Payment.create({ number: payNo, customerId: owing.customerId, orderId: owing._id, invoiceId: owing.invoiceId, amountPaise: amount, mode, type: "balance", reference: reference(rand, mode === "cheque" ? "CHQ" : "UTR"), receivedAt: payAt, recordedBy: who(salesUser), createdAt: payAt, updatedAt: payAt });
      await Order.updateOne({ _id: owing._id }, { $set: { paidPaise: owing.totalPaise, paymentStatus: "paid" } });
      const invoice = owing.invoiceId ? await Invoice.findById(owing.invoiceId).select("totalPaise").lean() : null;
      if (invoice) await Invoice.updateOne({ _id: invoice._id }, { $set: { paidPaise: invoice.totalPaise, status: "paid" } });
      t.add("order", owing._id, owing.customerId, "payment_recorded", `Balance of ${formatINR(amount)} received`, payAt, who(salesUser));
      done.push(`balance ${formatINR(amount)} collected`);
    }
  }
  if (t.docs.length) await Activity.insertMany(t.docs, insertOpts);
  return `${dd}${isToday ? " (today)" : ""}: ${done.join(", ") || "nothing yet"}`;
}
