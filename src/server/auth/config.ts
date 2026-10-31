/**
 * Full Auth.js setup: email + password (Credentials provider) checked against
 * bcrypt hashes in the `users` collection. Exposes `auth`, `signIn`, `signOut`
 * and the `/api/auth/*` route handlers.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "../db";
import { User } from "../models/user";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        await connectDB();
        const user = await User.findOne({ email: parsed.data.email, active: true }).select("+passwordHash").lean();
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: String(user._id), name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
