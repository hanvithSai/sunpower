/**
 * Shared context for the coverage seed: staff, catalog, the photo library, a
 * deterministic random source per section, and small document builders that
 * write exactly the shapes the services write (so every screen treats seeded
 * records like real ones).
 */
import { Types } from "mongoose";
import { addDays, addHours, startOfDayIST } from "@/lib/dates";
import { summarize } from "@/lib/gst";
import { estimateSubsidyPaise } from "@/lib/subsidy";
import { SYSTEM_TYPE_LABELS, type CustomerType, type SystemType } from "@/lib/constants";
import { Counter, Package, Product, User, type ILineItem, type IPackage, type IProduct } from "@/server/models";
import { ensurePhotoLibrary, type PhotoKey } from "../photos";
import { FIRST_NAMES, LAST_NAMES, NORTH, PLACES, pick, prng, type Place } from "../people";

export const DAY = 86_400_000;

export type Staff = { _id: Types.ObjectId; name: string; role: string; skills: string[]; hourlyRatePaise: number; email: string };
export type Who = { id: Types.ObjectId; name: string };

export type Ctx = {
  now: Date;
  today: Date;
  products: IProduct[];
  bySku: Map<string, IProduct>;
  byId: Map<string, IProduct>;
  packages: IPackage[];
  sales: Staff[];
  techs: Staff[];
  installers: Staff[];
  surveyors: Staff[];
  servicers: Staff[];
  keeper: Staff;
  support: Staff;
  director: Staff;
  photos: Map<PhotoKey, string[]>;
};

export async function loadCtx(now: Date): Promise<Ctx> {
  const [products, packages, users] = await Promise.all([Product.find().lean(), Package.find({ active: true }).lean(), User.find({ active: true }).sort({ email: 1 }).lean()]);
  const staff = users.map((u) => ({ _id: u._id, name: u.name, role: u.role, skills: u.skills ?? [], hourlyRatePaise: u.hourlyRatePaise ?? 0, email: u.email }));
  const techs = staff.filter((u) => u.role === "technician").sort((a, b) => a.name.localeCompare(b.name));
  const director = staff.find((u) => u.role === "admin")!;
  return {
    now,
    today: startOfDayIST(now),
    products: products as IProduct[],
    bySku: new Map(products.map((p) => [p.sku, p as IProduct])),
    byId: new Map(products.map((p) => [String(p._id), p as IProduct])),
    packages: packages as IPackage[],
    sales: staff.filter((u) => u.role === "sales"),
    techs,
    installers: techs.filter((t) => t.skills.includes("installation")),
    surveyors: techs.filter((t) => t.skills.includes("survey")),
    servicers: techs.filter((t) => t.skills.includes("service")),
    keeper: staff.find((u) => u.role === "warehouse")!,
    support: staff.find((u) => u.role === "support")!,
    director,
    photos: await ensurePhotoLibrary(String(director._id)),
  };
}

export const who = (u: Staff): Who => ({ id: u._id, name: u.name });

/** Run a section once; its marker is written only after it finishes. */
export async function once(marker: string, run: () => Promise<string>): Promise<string> {
  if (await Counter.exists({ _id: marker })) return `${marker}: already seeded`;
  const summary = await run();
  await Counter.create({ _id: marker, seq: 1 });
  return summary;
}

export { prng, pick };

/** A weighted pick: [[value, weight], ...]. */
export function weighted<T>(rand: () => number, table: readonly (readonly [T, number])[]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r <= 0) return v;
  }
  return table.at(-1)![0];
}

export const ist = (d: Date, hours: number) => addHours(startOfDayIST(d), hours);
/** Sundays off: move to Monday. */
export const workday = (d: Date) => (new Date(d.getTime() + 330 * 60_000).getUTCDay() === 0 ? addDays(d, 1) : d);
export { addDays, addHours };

/* ------------------------------ People ------------------------------ */

export const BUSINESSES = [
  { name: "Sri Venkateshwara Grand Hotel", city: "Secunderabad" },
  { name: "Green Valley High School", city: "Kompally" },
  { name: "Laxmi Textiles", city: "Warangal" },
  { name: "Annapurna Cold Storage", city: "Karimnagar" },
  { name: "Medplus Pharma Warehouse", city: "Uppal" },
  { name: "Charminar Printers", city: "Dilsukhnagar" },
  { name: "Deccan Diagnostics", city: "Madhapur" },
  { name: "Kaveri Seeds Processing Unit", city: "Nizamabad" },
  { name: "Sai Krupa Engineering Works", city: "Miyapur" },
  { name: "Godavari Ice Factory", city: "Khammam" },
] as const;

export function personName(rand: () => number): string {
  return `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`;
}

export function gstinFor(rand: () => number): string {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const l = (n: number) => Array.from({ length: n }, () => L[Math.floor(rand() * L.length)]).join("");
  return `36${l(3)}${pick(rand, ["C", "F", "P"])}${l(1)}${String(1000 + Math.floor(rand() * 8999))}${l(1)}1Z${Math.floor(rand() * 9)}`;
}

export function address(rand: () => number, place: Place) {
  return {
    line1: `${1 + Math.floor(rand() * 400)}-${1 + Math.floor(rand() * 90)}, ${pick(rand, place.areas)}`,
    city: place.city,
    district: place.district,
    state: "Telangana",
    pincode: place.pincode,
  };
}

export function customerDoc(rand: () => number, opts: { name: string; phone: string; place: Place; type: CustomerType; gstin?: string; at: Date; email?: string }) {
  const discom = NORTH.has(opts.place.city) ? "TSNPDCL" : "TSSPDCL";
  return {
    _id: new Types.ObjectId(),
    name: opts.name,
    phone: opts.phone,
    email: opts.email,
    type: opts.type,
    address: address(rand, opts.place),
    discom,
    consumerNumber: `${discom === "TSSPDCL" ? "1" : "2"}${String(10_000_000 + Math.floor(rand() * 89_999_999))}`,
    gstin: opts.gstin,
    createdAt: opts.at,
    updatedAt: opts.at,
  };
}

export const placeOf = (city: string) => PLACES.find((p) => p.city === city)!;
export { PLACES };

/* ------------------------------ Catalog ------------------------------ */

export function packageFor(ctx: Ctx, kw: number, systemType: SystemType): IPackage {
  return ctx.packages.find((p) => p.capacityKw === kw && p.systemType === systemType)!;
}

/** Package BOM priced and costed from the catalog, as saveQuote snapshots it. */
export function linesFor(ctx: Ctx, pkg: IPackage): ILineItem[] {
  return pkg.lines.map((l) => {
    const p = ctx.byId.get(String(l.productId))!;
    return { productId: p._id, sku: p.sku, name: p.name, category: p.category, unit: p.unit, qty: l.qty, unitPricePaise: p.pricePaise, unitCostPaise: p.costPaise, gstRate: p.gstRate, hsn: p.hsn, isSerialized: p.isSerialized, warrantyMonths: p.warrantyMonths };
  });
}

export function quoteFigures(ctx: Ctx, kw: number, systemType: SystemType, customerType: CustomerType) {
  const pkg = packageFor(ctx, kw, systemType);
  const lines = linesFor(ctx, pkg);
  const totals = summarize(lines);
  const subsidyPaise = estimateSubsidyPaise(kw, systemType, customerType);
  return { pkg, lines, totals, subsidyPaise, title: `${kw} kW ${SYSTEM_TYPE_LABELS[systemType]} system` };
}

/* ------------------------------ Photos ------------------------------ */

export function photo(ctx: Ctx, key: PhotoKey, n: number): string {
  const list = ctx.photos.get(key)!;
  return list[n % list.length]!;
}

/** What a surveyor photographs: the roof (by type), the meter board and maybe the shade. */
export function surveyPhotos(ctx: Ctx, n: number, opts: { commercial?: boolean; shaded?: boolean } = {}): string[] {
  const roof = opts.commercial ? photo(ctx, "metal_roof", n) : photo(ctx, opts.shaded ? "roof_shade" : "roof_empty", n);
  const out = [roof, photo(ctx, "meter_board", n + 1)];
  if (!opts.commercial) out.push(photo(ctx, "roof_empty", n + 2));
  if (opts.shaded && !opts.commercial) out.push(photo(ctx, "roof_shade", n + 1));
  return out;
}

/** Proof-of-work photos for a finished installation. */
export function installPhotos(ctx: Ctx, n: number, systemType: SystemType): string[] {
  const out = [photo(ctx, "array", n), photo(ctx, "panel_close", n), systemType === "off_grid" ? photo(ctx, "battery_bank", n) : photo(ctx, "inverter_wall", n), photo(ctx, "earth_pit", n)];
  if (systemType === "on_grid") out.push(photo(ctx, "net_meter", n));
  return out;
}

/* ------------------------------ Activity ------------------------------ */

export class Timeline {
  docs: object[] = [];
  add(entityType: string, entityId: Types.ObjectId, customerId: Types.ObjectId | undefined, action: string, message: string, at: Date, by?: Who) {
    this.docs.push({ entityType, entityId, customerId, action, message, actorId: by?.id, actorName: by?.name, createdAt: at, updatedAt: at });
  }
}

export const insertOpts = { ordered: false } as const;

export const reference = (rand: () => number, prefix: string) => `${prefix}${String(Math.floor(rand() * 1e10)).padStart(10, "0")}`;
