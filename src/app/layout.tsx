/**
 * Root layout: fonts, global styles, metadata, the toast host and the cookie
 * banner (a client component that renders nothing on the server).
 *
 * Kept fully static on purpose (Cache Components prerenders it into the static shell).
 * Request-time work such as reading the session lives behind <Suspense> in the
 * route-group layouts — never here.
 *
 * Inter is self-hosted (variable font, SIL OFL — see ./fonts) instead of fetched
 * from Google Fonts, so builds and on-site demos work on slow or offline networks.
 */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { LucideProvider } from "lucide-react";

import { ConsentBanner } from "@/components/shared/consent-banner";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = localFont({
  src: "./fonts/InterVariable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for canonical/Open Graph URLs; override per environment (e.g. previews).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sunpowersolutions.me"),
  title: {
    default: "SunPower OS",
    template: "%s · SunPower OS",
  },
  description:
    "SunPower OS runs a rooftop-solar business end to end: enquiries, site surveys, quotes with PM Surya Ghar subsidy, inventory and serial tracking, installations, service tickets and 20-year warranties.",
  applicationName: "SunPower OS",
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Every lucide icon in the app inherits the design-system stroke width. */}
        <LucideProvider strokeWidth={1.75}>
          {children}
          <Toaster />
          <ConsentBanner />
        </LucideProvider>
      </body>
    </html>
  );
}
