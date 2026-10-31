/**
 * Installation jobs: the crew calendar, each technician's "My work", and the
 * on-roof lifecycle.
 *
 *   start    → only after the kit is delivered (BR-14); the order moves to Installing
 *   complete → BR-14 proof: start/finish times, confirmed size (reason if it
 *              differs), generation tested, kit check, ≥ 1 photo, the customer's
 *              signature. In one transaction it marks the serials Installed,
 *              commissions the order, writes a time log per crew member, posts
 *              any extra material to stock and to the order's costs, and keeps
 *              everything the certificate needs.
 */
import { Types } from "mongoose";
import { SYSTEM_TYPE_LABELS, type Role } from "@/lib/constants";
import { addDays, getRange, startOfDayIST } from "@/lib/dates";
import { formatDateTime, fromISTInput } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { CompleteJobInput, RescheduleJobInput } from "@/lib/validation/jobs";
import { JOB_FLOW, ORDER_FLOW } from "@/lib/workflows";
import { connectDB, withTransaction } from "../db";
import { AppError, assertTransition, notFoundError } from "../errors";
import type { Actor } from "../lib/actor";
import { Customer, Job, Order, Product, SerialUnit, Survey, User, type IJob } from "../models";
import { logActivity } from "./core/activity";
import { busyTechnicianIds } from "./core/crew";
import { getFilesInfo } from "./core/files";
import { moveStock } from "./core/stock";

export type JobActor = Actor & { role: Role };

const HOUR_MS = 3_600_000;

function assertCrew(job: Pick<IJob, "technicianIds">, actor: JobActor, verb: string) {
  if (actor.role === "admin") return;
  if (!job.technicianIds.some((t) => t.equals(actor.id))) {
    throw new AppError("FORBIDDEN", `Only the crew booked on this job can ${verb} it.`);
  }
}

/* --------------------------------- Reads -------------------------------- */

/** One week (Monday–Sunday, IST) of jobs, plus every technician for the crew grid. */
export async function getJobCalendar(anchor: Date) {
  await connectDB();
  const { start } = getRange("week", anchor);
  const end = addDays(start, 7);
  const [jobs, technicians] = await Promise.all([
    Job.find({ scheduledFor: { $gte: start, $lt: end }, status: { $ne: "cancelled" } }).sort({ scheduledFor: 1 }).lean(),
    User.find({ role: "technician", active: true }).select("name skills").sort({ name: 1 }).lean(),
  ]);
  const [customers, orders] = await Promise.all([
    Customer.find({ _id: { $in: jobs.map((j) => j.customerId) } }).select("name").lean(),
    Order.find({ _id: { $in: jobs.flatMap((j) => (j.orderId ? [j.orderId] : [])) } }).select("number status").lean(),
  ]);
  const customerById = new Map(customers.map((c) => [String(c._id), c.name]));
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  // Technician + day pairs with more than one job: shown as clashes on the grid.
  const slots = new Map<string, number>();
  for (const j of jobs) {
    const day = startOfDayIST(j.scheduledFor).getTime();
    for (const t of j.technicianIds) slots.set(`${t}|${day}`, (slots.get(`${t}|${day}`) ?? 0) + 1);
  }

  return {
    weekStart: start,
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    technicians: technicians.map((t) => ({ id: String(t._id), name: t.name, skills: t.skills ?? [] })),
    clashes: [...slots.entries()].filter(([, n]) => n > 1).map(([key]) => key),
    jobs: jobs.map((j) => {
      const order = j.orderId ? orderById.get(String(j.orderId)) : undefined;
      return {
        id: String(j._id),
        number: j.number,
        type: j.type,
        title: j.title,
        status: j.status,
        scheduledFor: j.scheduledFor,
        dayStart: startOfDayIST(j.scheduledFor),
        technicianIds: j.technicianIds.map(String),
        customerName: customerById.get(String(j.customerId)) ?? "—",
        city: j.siteAddress.city,
        orderNumber: order?.number,
        orderStatus: order?.status,
      };
    }),
  };
}

/** The technician's phone home: today's and upcoming surveys and jobs, and hours this month. */
export async function getMyWork(userId: string, now: Date) {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const todayStart = startOfDayIST(now);
  const monthStart = getRange("month", now).start;

  const [jobs, done, surveys, hours] = await Promise.all([
    Job.find({ technicianIds: uid, status: { $in: ["scheduled", "in_progress"] } }).sort({ scheduledFor: 1 }).limit(40).lean(),
    Job.find({ technicianIds: uid, status: "completed", finishedAt: { $gte: addDays(todayStart, -7) } }).sort({ finishedAt: -1 }).limit(10).lean(),
    Survey.find({ technicianId: uid, status: "scheduled" }).sort({ scheduledFor: 1 }).limit(20).lean(),
    Job.aggregate<{ hours: number; jobs: number }>([
      { $match: { "timeLogs.technicianId": uid, "timeLogs.date": { $gte: monthStart } } },
      { $unwind: "$timeLogs" },
      { $match: { "timeLogs.technicianId": uid, "timeLogs.date": { $gte: monthStart } } },
      { $group: { _id: null, hours: { $sum: "$timeLogs.hours" }, jobs: { $sum: 1 } } },
    ]),
  ]);
  const customerIds = [...jobs, ...done].map((j) => j.customerId).concat(surveys.map((s) => s.customerId));
  const [customers, orders] = await Promise.all([
    Customer.find({ _id: { $in: customerIds } }).select("name phone address").lean(),
    Order.find({ _id: { $in: jobs.flatMap((j) => (j.orderId ? [j.orderId] : [])) } }).select("number status").lean(),
  ]);
  const customerById = new Map(customers.map((c) => [String(c._id), c]));
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  type Item = {
    kind: "survey" | "installation" | "service";
    id: string;
    href: string;
    number: string;
    title: string;
    at: Date;
    status: string;
    customerName: string;
    phone?: string;
    address: string;
    /** Why it can't start yet, if anything. */
    blocker?: string;
  };
  const address = (a?: { line1?: string; city?: string; pincode?: string }) => [a?.line1, a?.city, a?.pincode].filter(Boolean).join(", ");

  const items: Item[] = [
    ...surveys.map((s): Item => {
      const c = customerById.get(String(s.customerId));
      return { kind: "survey", id: String(s._id), href: `/surveys/${s._id}`, number: s.number, title: "Site survey", at: s.scheduledFor, status: s.status, customerName: c?.name ?? "—", phone: c?.phone, address: address(c?.address) };
    }),
    ...jobs.map((j): Item => {
      const c = customerById.get(String(j.customerId));
      const order = j.orderId ? orderById.get(String(j.orderId)) : undefined;
      const waiting = j.type === "installation" && j.status === "scheduled" && order && !["delivered", "installing"].includes(order.status);
      return {
        kind: j.type,
        id: String(j._id),
        href: `/jobs/${j._id}`,
        number: j.number,
        title: j.title,
        at: j.scheduledFor,
        status: j.status,
        customerName: c?.name ?? "—",
        phone: c?.phone,
        address: address(j.siteAddress),
        blocker: waiting ? "Kit not delivered yet" : undefined,
      };
    }),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const tomorrow = addDays(todayStart, 1);
  return {
    inProgress: items.filter((i) => i.status === "in_progress"),
    today: items.filter((i) => i.status !== "in_progress" && i.at < tomorrow),
    upcoming: items.filter((i) => i.status !== "in_progress" && i.at >= tomorrow),
    recentDone: done.map((j) => ({ id: String(j._id), number: j.number, title: j.title, finishedAt: j.finishedAt!, customerName: customerById.get(String(j.customerId))?.name ?? "—" })),
    hoursThisMonth: hours[0]?.hours ?? 0,
    jobsThisMonth: hours[0]?.jobs ?? 0,
  };
}

export async function getJobDetail(jobId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(jobId)) return null;
  const job = await Job.findById(jobId).lean();
  if (!job) return null;

  const [customer, order, crew, serials, materials] = await Promise.all([
    Customer.findById(job.customerId).select("name phone email address discom consumerNumber").lean(),
    job.orderId ? Order.findById(job.orderId).select("number status capacityKw systemType lines pickList dispatch commissionedAt").lean() : null,
    User.find({ _id: { $in: job.technicianIds } }).select("name phone").lean(),
    job.orderId ? SerialUnit.find({ orderId: job.orderId }).select("serial productName category status warrantyStartAt warrantyEndAt").sort({ category: 1, serial: 1 }).lean() : [],
    Product.find({ active: true, isSerialized: false, category: { $nin: ["service"] } }).select("sku name unit costPaise").sort({ name: 1 }).lean(),
  ]);
  const crewById = new Map(crew.map((c) => [String(c._id), c]));

  return {
    job: {
      id: String(job._id),
      number: job.number,
      type: job.type,
      title: job.title,
      status: job.status,
      scheduledFor: job.scheduledFor,
      estimatedHours: job.estimatedHours,
      siteAddress: job.siteAddress,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      confirmedKw: job.confirmedKw,
      kwChangeReason: job.kwChangeReason,
      generationReadingKw: job.generationReadingKw,
      checklist: job.checklist,
      kitCheck: job.kitCheck,
      photos: job.photos,
      signature: job.signature,
      customerRemarks: job.customerRemarks,
      notes: job.notes,
      timeLogs: job.timeLogs.map((t) => ({ technicianId: String(t.technicianId), technicianName: t.technicianName, hours: t.hours, date: t.date })),
      materialsUsed: job.materialsUsed.map((m) => ({ ...m, productId: String(m.productId) })),
      crew: job.technicianIds.map((id) => ({ id: String(id), name: crewById.get(String(id))?.name ?? "—", phone: crewById.get(String(id))?.phone, lead: Boolean(job.leadTechnicianId?.equals(id)) })),
      technicianIds: job.technicianIds.map(String),
    },
    customer: customer
      ? { id: String(customer._id), name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, discom: customer.discom, consumerNumber: customer.consumerNumber }
      : null,
    order: order
      ? {
          id: String(order._id),
          number: order.number,
          status: order.status,
          capacityKw: order.capacityKw,
          systemType: order.systemType,
          systemLabel: SYSTEM_TYPE_LABELS[order.systemType],
          deliveredAt: order.dispatch?.deliveredAt,
          commissionedAt: order.commissionedAt,
          lines: order.lines.filter((l) => l.category !== "service").map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, unit: l.unit })),
        }
      : null,
    serials: serials.map((s) => ({ serial: s.serial, productName: s.productName, category: s.category, status: s.status, warrantyStartAt: s.warrantyStartAt, warrantyEndAt: s.warrantyEndAt })),
    extraProducts: materials.map((p) => ({ id: String(p._id), sku: p.sku, name: p.name, unit: p.unit, costPaise: p.costPaise })),
  };
}

/* ------------------------------ Mutations ------------------------------- */

/** Move a job or change its crew. Double bookings are allowed but returned as warnings. */
export async function rescheduleJob(input: RescheduleJobInput, actor: Actor): Promise<{ warnings: string[] }> {
  await connectDB();
  const job = await Job.findById(input.jobId);
  if (!job) throw notFoundError("Job");
  if (job.status !== "scheduled") throw new AppError("INVALID_STATE", "Only jobs that haven't started can be rescheduled.");

  const scheduledFor = fromISTInput(input.scheduledFor);
  if (scheduledFor.getTime() < startOfDayIST(new Date()).getTime()) {
    throw new AppError("VALIDATION", "Pick today or a later date.", { scheduledFor: "Can't be in the past" });
  }
  const ids = [...new Set(input.technicianIds)];
  const technicians = await User.find({ _id: { $in: ids }, role: "technician", active: true }).select("name").lean();
  if (technicians.length !== ids.length) throw new AppError("VALIDATION", "Pick active technicians only.", { technicianIds: "Pick active technicians only" });
  const lead = input.leadTechnicianId && ids.includes(input.leadTechnicianId) ? input.leadTechnicianId : ids[0]!;

  const busy = await busyTechnicianIds(startOfDayIST(scheduledFor), undefined, job._id);
  const warnings = technicians.filter((t) => busy.has(String(t._id))).map((t) => `${t.name} already has a job that day`);

  job.scheduledFor = scheduledFor;
  job.technicianIds = ids.map((id) => new Types.ObjectId(id));
  job.leadTechnicianId = new Types.ObjectId(lead);
  await job.save();
  await logActivity({
    entityType: "job",
    entityId: job._id,
    customerId: job.customerId,
    action: "rescheduled",
    message: `Booked for ${formatDateTime(scheduledFor)} with ${technicians.map((t) => t.name).join(", ")}${warnings.length ? ` (double-booked: ${warnings.length})` : ""}`,
    actor,
  });
  return { warnings };
}

export async function startJob(jobId: string, actor: JobActor, opts: { at?: Date } = {}) {
  return withTransaction(async (session) => {
    const now = opts.at ?? new Date();
    const job = await Job.findById(jobId).session(session);
    if (!job) throw notFoundError("Job");
    assertCrew(job, actor, "start");
    assertTransition("job", JOB_FLOW, job.status, "in_progress");

    if (job.type === "installation") {
      const order = job.orderId ? await Order.findById(job.orderId).session(session) : null;
      if (!order) throw notFoundError("Order");
      if (order.status !== "delivered") {
        throw new AppError("INVALID_STATE", "The installation can start once the kit is delivered to site.");
      }
      order.status = "installing";
      await order.save({ session });
      await logActivity({ entityType: "order", entityId: order._id, customerId: order.customerId, action: "installing", message: `Installation ${job.number} started by ${actor.name}`, actor, at: now }, session);
    }
    job.status = "in_progress";
    job.startedAt = now;
    await job.save({ session });
    await logActivity({ entityType: "job", entityId: job._id, customerId: job.customerId, action: "started", message: `Started on site by ${actor.name}`, actor, at: now }, session);
    return { number: job.number };
  });
}

/** BR-14: the installation closes only with complete proof; everything downstream updates in one go. */
export async function completeJob(input: CompleteJobInput, actor: JobActor, opts: { now?: Date } = {}) {
  await connectDB();
  const now = opts.now ?? new Date();

  const stored = await getFilesInfo(input.photos);
  if (stored.length !== new Set(input.photos.map((p) => p.toLowerCase())).size) {
    throw new AppError("VALIDATION", "Some photos didn't finish uploading. Remove them and try again.", { photos: "Some photos didn't finish uploading" });
  }

  return withTransaction(async (session) => {
    const job = await Job.findById(input.jobId).session(session);
    if (!job) throw notFoundError("Job");
    assertCrew(job, actor, "complete");
    assertTransition("job", JOB_FLOW, job.status, "completed");

    const startedAt = input.startedAt ? fromISTInput(input.startedAt) : (job.startedAt ?? now);
    const finishedAt = input.finishedAt ? fromISTInput(input.finishedAt) : now;
    if (finishedAt.getTime() > now.getTime() + 5 * 60_000) throw new AppError("VALIDATION", "The finish time can't be in the future.", { finishedAt: "Can't be in the future" });
    if (finishedAt.getTime() <= startedAt.getTime()) throw new AppError("VALIDATION", "The finish time must be after the start.", { finishedAt: "Must be after the start" });
    if (finishedAt.getTime() - startedAt.getTime() > 16 * HOUR_MS) throw new AppError("VALIDATION", "More than 16 hours on site — check the start time.", { startedAt: "Check the start time" });
    const hours = Math.max(0.25, Math.round(((finishedAt.getTime() - startedAt.getTime()) / HOUR_MS) * 4) / 4);

    const order = job.orderId ? await Order.findById(job.orderId).session(session) : null;
    if (job.type === "installation") {
      if (!order) throw notFoundError("Order");
      if (Math.abs(input.confirmedKw - order.capacityKw) > 0.01 && !input.kwChangeReason) {
        throw new AppError("VALIDATION", `The order is for ${order.capacityKw} kW — say why ${input.confirmedKw} kW was installed.`, { kwChangeReason: "Give a reason for the different size" });
      }
    }

    // Extra material used on site: out of stock, onto the job and the order's costs.
    const materialsUsed: IJob["materialsUsed"] = [];
    if (input.extras.length > 0) {
      const products = await Product.find({ _id: { $in: input.extras.map((e) => e.productId) }, isSerialized: false, category: { $ne: "service" } }).session(session).lean();
      const productById = new Map(products.map((p) => [String(p._id), p]));
      for (const extra of input.extras) {
        const product = productById.get(extra.productId);
        if (!product) throw new AppError("VALIDATION", "Extra material must be a bulk stock item.", { extras: "Pick bulk stock items only" });
        await moveStock(
          { productId: product._id, qty: -extra.qty, type: "dispatch", refType: "order", refId: order?._id, refNumber: order?.number, note: `Extra used on site, job ${job.number}`, actor, at: finishedAt },
          session,
        );
        materialsUsed.push({ productId: product._id, sku: product.sku, name: product.name, unit: product.unit, qty: extra.qty, costPaise: Math.round(extra.qty * product.costPaise) });
      }
    }

    const crew = await User.find({ _id: { $in: job.technicianIds } }).select("name").session(session).lean();
    job.status = "completed";
    job.startedAt = startedAt;
    job.finishedAt = finishedAt;
    job.confirmedKw = input.confirmedKw;
    job.kwChangeReason = input.kwChangeReason;
    job.generationReadingKw = input.generationReadingKw;
    job.checklist = { mounting: input.mounting, panels: input.panels, wiring: input.wiring, earthing: input.earthing, inverter: input.inverter, testing: input.generationTested };
    job.kitCheck = { complete: input.kitComplete, missing: input.kitComplete ? undefined : input.missingItems };
    job.photos = input.photos;
    job.signature = { dataUrl: input.signature, signedBy: input.signedBy, signedAt: finishedAt };
    job.customerRemarks = input.customerRemarks;
    job.notes = input.notes;
    job.materialsUsed = materialsUsed;
    job.timeLogs = crew.map((c) => ({ technicianId: c._id, technicianName: c.name, hours, date: startedAt }));
    job.completedBy = new Types.ObjectId(actor.id);
    await job.save({ session });

    let serialCount = 0;
    if (order) {
      const installed = await SerialUnit.updateMany(
        { orderId: order._id, status: "dispatched" },
        { $set: { status: "installed" }, $push: { history: { status: "installed", at: finishedAt, note: `Installed by job ${job.number}`, by: actor.name } } },
        { session },
      );
      serialCount = installed.modifiedCount;

      for (const m of materialsUsed) order.extraCosts.push({ label: `Extra ${m.qty} ${m.unit} ${m.name} (${job.number})`, amountPaise: m.costPaise, at: finishedAt });
      if (input.extraCostRs) order.extraCosts.push({ label: `${input.extraCostNote} (${job.number})`, amountPaise: Math.round(input.extraCostRs * 100), at: finishedAt });
      assertTransition("order", ORDER_FLOW, order.status, "commissioned");
      order.status = "commissioned";
      order.commissionedAt = finishedAt;
      await order.save({ session });
      await logActivity(
        {
          entityType: "order",
          entityId: order._id,
          customerId: order.customerId,
          action: "commissioned",
          message: `Commissioned: ${input.confirmedKw} kW installed, ${serialCount} serials in service, signed by ${input.signedBy}`,
          actor,
          at: finishedAt,
        },
        session,
      );
    }

    const extrasPaise = materialsUsed.reduce((s, m) => s + m.costPaise, 0) + Math.round((input.extraCostRs ?? 0) * 100);
    await logActivity(
      {
        entityType: "job",
        entityId: job._id,
        customerId: job.customerId,
        action: "completed",
        message: `Completed: ${crew.length} crew × ${hours} h logged${extrasPaise ? `, extras ${formatINR(extrasPaise)}` : ""}; accepted by ${input.signedBy}`,
        actor,
        at: finishedAt,
      },
      session,
    );
    return { jobNumber: job.number, orderNumber: order?.number, hours, crew: crew.length, serials: serialCount, extrasPaise };
  });
}
