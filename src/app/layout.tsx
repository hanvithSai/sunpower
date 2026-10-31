/**
 * Root layout: fonts, global styles, metadata, the toast host and the cookie
 * banner (a client component that renders nothing on the server).
 *
 * Kept fully static on purpose (Cache Components prerenders it into the static shell).
 * Request-time work such as reading the session lives behind <Suspense> in the
 * route-group layouts — never here.
 *
 * IBM Plex Sans (interface) and Bricolage Grotesque (display) are self-hosted
 * variable fonts (SIL OFL — see ./fonts) instead of fetched from Google Fonts,
 * so builds and on-site demos work on slow or offline networks.
 */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { LucideProvider } from "lucide-react";

import { ConsentBanner } from "@/components/shared/consent-banner";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plex = localFont({
  src: "./fonts/IBMPlexSans-latin.woff2",
  variable: "--font-plex",
  weight: "100 700",
  display: "swap",
});

const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-latin.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for canonical/Open Graph URLs; override per environment (e.g. previews).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sunpowersolutions.me"),
  title: {
    default: "SunPower — rooftop solar, from first enquiry to every unit delivered",
    template: "%s · SunPower",
  },
  description:
    "SunPower runs a rooftop-solar business end to end: enquiries, site surveys, quotes with PM Surya Ghar subsidy, inventory and serial tracking, installations, service tickets and 20-year warranties.",
  applicationName: "SunPower",
};

export const viewport: Viewport = {
  themeColor: "#0f2f24",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${plex.variable} ${bricolage.variable} h-full antialiased`}>
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
