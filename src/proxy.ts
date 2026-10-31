/**
 * Request proxy (Next.js 16's replacement for middleware.ts).
 * Optimistic auth check using the JWT cookie only — no DB. Signed-out users
 * opening staff pages are redirected to /login?callbackUrl=...; public pages
 * (landing, enquiry, warranty, share links) pass through. API routes are
 * excluded here and enforce auth themselves with JSON 401s.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|ingest|favicon.ico|icon.svg|logo.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
