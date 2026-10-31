"use server";
/**
 * Installation job Server Actions: reschedule / reassign the crew (sales,
 * admin), start on site and complete with proof (the booked technicians).
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { CompleteJobSchema, JobIdSchema, RescheduleJobSchema } from "@/lib/validation/jobs";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import { completeJob, rescheduleJob, startJob } from "../services/jobs";

function refreshJob(jobId: string) {
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/my-work");
  revalidatePath("/orders");
  revalidatePath("/dispatch");
}

export async function rescheduleJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {
    const input = parseForm(RescheduleJobSchema, formData);
    const { warnings } = await rescheduleJob(input, user);
    refreshJob(input.jobId);
    return { ok: true, message: warnings.length ? `Saved — note: ${warnings.join("; ")}` : "Job rescheduled" };
  });
}

export async function startJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["technician"], async (user) => {
    const { jobId } = parseForm(JobIdSchema, formData);
    const result = await startJob(jobId, user);
    refreshJob(jobId);
    trackServer("job_started", {}, user.id);
    return { ok: true, message: `${result.number} started — the clock is running` };
  });
}

export async function completeJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["technician"], async (user) => {
    const input = parseForm(CompleteJobSchema, formData);
    const result = await completeJob(input, user);
    refreshJob(input.jobId);
    trackServer("job_completed", { hours: result.hours, crew: result.crew, serials: result.serials, hasExtras: result.extrasPaise > 0 }, user.id);
    return {
      ok: true,
      message: `${result.jobNumber} completed${result.orderNumber ? ` — ${result.orderNumber} commissioned` : ""}. ${result.crew} × ${result.hours} h logged.`,
    };
  });
}
