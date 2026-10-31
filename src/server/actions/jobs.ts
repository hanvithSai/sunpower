"use server";
/**
 * Installation job Server Actions: reschedule / reassign the crew (sales,
 * admin), start on site and complete with proof (the booked technicians), and
 * the customer's certificate link.
 */
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { CompleteJobSchema, JobIdSchema, RescheduleJobSchema } from "@/lib/validation/jobs";
import { trackServer } from "../analytics";
import { runAction } from "../lib/action";
import { parseForm } from "../lib/validate";
import { certificateLink } from "../services/finance";
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
    // The customer's proof goes out as a link (F22-lite); the job page shows the WhatsApp button.
    await certificateLink(input.jobId, user);
    refreshJob(input.jobId);
    trackServer("job_completed", { durationHours: Math.round(result.hours * 10) / 10, crew: result.crew, serials: result.serials, hasExtras: result.extrasPaise > 0 }, user.id);
    return {
      ok: true,
      message: `${result.jobNumber} completed${result.orderNumber ? ` — ${result.orderNumber} commissioned` : ""}. ${result.crew} × ${result.hours} h logged.`,
    };
  });
}

/** Create (or reuse) the customer's certificate link for a completed installation. */
export async function certificateLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales", "technician", "support"], async (user) => {
    const { jobId } = parseForm(JobIdSchema, formData);
    const link = await certificateLink(jobId, user);
    refreshJob(jobId);
    if (link.created) trackServer("certificate_shared", {}, user.id);
    return { ok: true, message: link.created ? "Certificate link ready — send it on WhatsApp" : "The certificate link is ready", data: { token: link.token } };
  });
}
