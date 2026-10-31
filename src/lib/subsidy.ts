/**
 * PM Surya Ghar: Muft Bijli Yojana — central financial assistance (CFA).
 *
 * Residential, grid-connected (on-grid) rooftop systems only:
 *   ₹30,000 per kW for the first 2 kW, ₹18,000 for the 3rd kW, capped at ₹78,000.
 * Off-grid and commercial systems are not eligible. The subsidy is credited to
 * the customer's bank account after DISCOM inspection, so it never reduces our
 * invoice — quotes show it as the customer's "effective cost".
 */
import type { CustomerType, SystemType } from "./constants";

export const SUBSIDY_RULES = {
  perKwFirstTwoRs: 30_000,
  thirdKwRs: 18_000,
  capRs: 78_000,
} as const;

export function isSubsidyEligible(systemType: SystemType, customerType: CustomerType = "residential"): boolean {
  return systemType === "on_grid" && customerType === "residential";
}

export function estimateSubsidyRs(
  capacityKw: number,
  systemType: SystemType,
  customerType: CustomerType = "residential",
): number {
  if (!isSubsidyEligible(systemType, customerType) || capacityKw <= 0) return 0;
  const firstTwo = Math.min(capacityKw, 2) * SUBSIDY_RULES.perKwFirstTwoRs;
  const third = Math.max(0, Math.min(capacityKw, 3) - 2) * SUBSIDY_RULES.thirdKwRs;
  return Math.min(Math.round(firstTwo + third), SUBSIDY_RULES.capRs);
}

export function estimateSubsidyPaise(
  capacityKw: number,
  systemType: SystemType,
  customerType: CustomerType = "residential",
): number {
  return estimateSubsidyRs(capacityKw, systemType, customerType) * 100;
}
