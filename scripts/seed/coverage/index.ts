/**
 * Demo coverage: everything around the finished installations (history.ts)
 * and today's walkthrough pipeline (pipeline.ts), so every screen, stage,
 * filter and category has records — nothing shows an empty state or a zero
 * by accident. Each section runs once behind its own marker, so an
 * interrupted seed picks up where it stopped; the photo backfill and the
 * day-by-day activity run on every seed.
 *
 *   installed base   2–3-year-old installations (inverters now out of
 *                    warranty) and a denser last six weeks
 *   funnel           a year of lost enquiries; today's open pipeline
 *   orders           Panel Set sales, cancellations, every in-flight stage and
 *                    installations booked twelve weeks ahead
 *   service          a year of tickets for every technician; today's desk
 *   warehouse        write-offs, RMA returns, cycle counts, site returns
 *   sharing          dashboard and certificate links
 *   media            site photos and subsidy papers on every record
 *   daily            the last week and today, re-filled on every run
 */
import { addMonths } from "@/lib/warranty";
import { FACTORIES } from "../people";
import { insertInstallations, type Spec } from "../history";
import { seededPhone } from "../people";
import { seedDaily } from "./daily";
import { seedLostLeads, seedOpenPipeline } from "./funnel";
import { seedInFlight, seedPanelSets } from "./orders";
import { seedLiveTickets, seedServiceHistory } from "./service";
import { backfillMedia, seedShareLinks, seedWarehouseEdges } from "./warehouse";
import { PLACES, addDays, ist, loadCtx, once, personName, pick, prng, weighted, type Ctx } from "./common";

function installedBase(ctx: Ctx): { legacy: Spec[]; recent: Spec[] } {
  const rand = prng(60006);
  const spec = (i: number, commissionedAt: Date, extra: Partial<Spec> = {}): Spec => {
    const place = pick(rand, PLACES);
    return {
      name: personName(rand),
      phone: seededPhone(6900 + i),
      place,
      area: pick(rand, place.areas),
      kw: pick(rand, [2, 3, 3, 4, 5]),
      systemType: rand() < 0.2 ? "off_grid" : "on_grid",
      commissionedAt,
      overtimeHours: 0,
      extras: [],
      unpaidBalance: false,
      subsidyRejected: false,
      source: weighted(rand, [["referral", 3], ["website", 2], ["phone", 2], ["walk_in", 1]] as const),
      ...extra,
    };
  };
  // Installed 26–38 months ago: the inverters' 24-month warranty has run out, so faults there are billable.
  const legacy = Array.from({ length: 12 }, (_, i) => {
    const factory = i === 4 || i === 9 ? FACTORIES[i === 4 ? 1 : 3]! : null;
    return spec(i, ist(addMonths(ctx.now, -(26 + i)), 15), factory ? { name: `${factory.name} (Godown)`, commercial: { gstin: factory.gstin.replace(/.$/, "X") }, place: PLACES.find((p) => p.city === factory.city)!, kw: 5, systemType: "on_grid" } : {});
  });
  // A little denser over the last ten weeks: subsidy files at feasibility and net-meter stages, balances still due.
  const recent = Array.from({ length: 8 }, (_, i) =>
    spec(40 + i, ist(addDays(ctx.now, -(8 + i * 9)), 15), { unpaidBalance: i % 3 === 0, subsidyRejected: i === 7, overtimeHours: i === 5 ? 6 : 0, extras: i === 2 ? [{ label: "Extra 30 m AC cable — meter board on the far side", amountPaise: 30 * 9_500, daysAfter: 0 }] : [],
      // Elevated structures (2 m clearance for a terrace garden or parking) carry a premium installation rate.
      ...(i === 1 || i === 4 || i === 6 ? { installRatePaise: 9_500_00, kw: 5, systemType: "on_grid" as const } : {}) }),
  );
  return { legacy, recent };
}

export async function seedCoverage(now = new Date()): Promise<string[]> {
  const ctx = await loadCtx(now);
  const out: string[] = [];
  const { legacy, recent } = installedBase(ctx);
  out.push(await once("seed:cov:legacy", async () => `Installed base: ${(await insertInstallations(legacy, { now, tag: "L", seed: 61001 })).summary} (26–38 months old)`));
  out.push(await once("seed:cov:recent", async () => `Recent installs: ${(await insertInstallations(recent, { now, tag: "R", seed: 61002 })).summary}`));
  out.push(await once("seed:cov:lost", () => seedLostLeads(ctx)));
  out.push(await once("seed:cov:panelsets", () => seedPanelSets(ctx)));
  out.push(await once("seed:cov:service", () => seedServiceHistory(ctx)));
  out.push(await once("seed:cov:open", () => seedOpenPipeline(ctx)));
  out.push(await once("seed:cov:inflight", () => seedInFlight(ctx)));
  out.push(await once("seed:cov:tickets", () => seedLiveTickets(ctx)));
  out.push(await once("seed:cov:warehouse", () => seedWarehouseEdges(ctx)));
  out.push(await once("seed:cov:share", () => seedShareLinks(ctx)));
  out.push(await seedDaily(ctx));
  out.push(await backfillMedia(ctx));
  return out;
}
