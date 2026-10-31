"use server";
/**
 * Site-survey Server Actions: the technician's submission from the roof and
 * the sales review that unlocks quoting.
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { ReviewSurveySchema, SubmitSurveySchema } from "@/lib/validation/surveys";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import { reviewSurvey, submitSurvey } from "../services/surveys";

function refresh(surveyId: string, leadId: string) {
  revalidatePath("/surveys");
  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/my-work");
}

export async function submitSurveyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["technician"], async (user) => {
    if (formData.get("photos__uploading")) {
      return { ok: false, message: "Please wait for the photos to finish uploading." };
    }
    const input = parseForm(SubmitSurveySchema, formData);
    const { leadId } = await submitSurvey(input, user);
    refresh(input.surveyId, leadId);
    trackServer("survey_completed", {}, user.id);
    return { ok: true, message: "Survey submitted for review" };
  });
}

const REVIEW_MESSAGES = {
  approve: "Survey approved — the quote is unlocked",
  resurvey: "Re-survey booked for tomorrow, 10:00 AM",
  not_feasible: "Lead closed as not feasible",
} as const;

export async function reviewSurveyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const input = parseForm(ReviewSurveySchema, formData);
    const { leadId, newSurveyId } = await reviewSurvey(input, user);
    refresh(input.surveyId, leadId);
    trackServer("survey_reviewed", { decision: input.decision }, user.id);
    return { ok: true, message: REVIEW_MESSAGES[input.decision], data: { leadId, newSurveyId } };
  });
}
