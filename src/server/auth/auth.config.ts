/**
 * Auth.js (NextAuth v5) configuration that is safe to run in the request
 * proxy: no database access here. The Credentials provider (which queries
 * MongoDB) is added in ./config.ts. JWT sessions carry the user's id and role,
 * so route protection in proxy.ts needs no DB round-trip.
 */
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/constants";
import { roleHome } from "@/lib/navigation";

/** Pages anyone can open without signing in. */
const PUBLIC_PATHS = new Set(["/", "/enquiry", "/warranty", "/privacy", "/login"]);
const PUBLIC_PREFIXES = ["/share/", "/enquiry/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  callbacks: {
    /** Runs in proxy.ts for every page request. Returning false redirects to /login. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;
      if (pathname === "/login" && role) {
        return Response.redirect(new URL(roleHome(role), request.nextUrl));
      }
      if (isPublicPath(pathname)) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
