/**
 * Site-survey validation: the technician's on-roof measurements and the sales
 * review decision that unlocks (or blocks) quoting.
 */
import { z } from "zod";
import { ROOF_DIRECTIONS, ROOF_TYPES, SYSTEM_TYPES } from "../constants";
import { checkbox, enumOf, objectId, optionalText, requiredNumber } from "./common";

const toArray = (v: unknown) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);

export const SubmitSurveySchema = z.object({
  surveyId: objectId,
  roofDirection: enumOf(ROOF_DIRECTIONS, "roof direction"),
  tiltDeg: requiredNumber("Roof tilt", 0, 60),
  roofType: enumOf(ROOF_TYPES, "roof type"),
  usableAreaSqft: requiredNumber("Usable area", 10, 1_00_000),
  shadingPct: requiredNumber("Shading", 0, 100),
  cableDistanceM: requiredNumber("Cable distance", 0, 500),
  floors: requiredNumber("Floors", 0, 50),
  earthingPossible: checkbox,
  recommendedKw: requiredNumber("Recommended size", 1, 10),
  recommendedSystemType: enumOf(SYSTEM_TYPES, "system type"),
  notes: optionalText(2000),
  photos: z.preprocess(
    toArray,
    z.array(objectId).min(1, "Add at least one roof photo").max(12, "Up to 12 photos"),
  ),
});
export type SubmitSurveyInput = z.output<typeof SubmitSurveySchema>;

export const SURVEY_DECISIONS = ["approve", "resurvey", "not_feasible"] as const;
export type SurveyDecision = (typeof SURVEY_DECISIONS)[number];

export const ReviewSurveySchema = z
  .object({
    surveyId: objectId,
    decision: z.enum(SURVEY_DECISIONS, { error: "Choose a decision" }),
    note: optionalText(500),
  })
  .refine((v) => v.decision === "approve" || Boolean(v.note), {
    path: ["note"],
    message: "Add a short note explaining why",
  });
export type ReviewSurveyInput = z.output<typeof ReviewSurveySchema>;
