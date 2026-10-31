"use server";
/**
 * Sign-in / sign-out Server Actions used by the login form and user menu.
 * After login, each role lands on its own home (director -> dashboard,
 * technician -> my work, ...) unless a safe callbackUrl was requested.
 */
import { AuthError } from "next-auth";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { roleHome } from "@/lib/navigation";
import { signIn, signOut } from "../auth/config";
import { connectDB } from "../db";
import { User } from "../models/user";

const LoginSchema = z.object({
  email: z.email("Enter a valid email address").transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please check your details.", fieldErrors };
  }

  const callbackUrl = String(formData.get("callbackUrl") ?? "");
  let destination = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "";

  try {
    if (!destination || destination === "/login") {
      await connectDB();
      const user = await User.findOne({ email: parsed.data.email }).select("role").lean();
      destination = user ? roleHome(user.role) : "/dashboard";
    }
    await signIn("credentials", { ...parsed.data, redirectTo: destination });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, message: "Incorrect email or password." };
    unstable_rethrow(error); // successful sign-in throws a redirect
    console.error("[auth] login failed", error);
    return { ok: false, message: "We couldn't sign you in right now. Please try again." };
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
