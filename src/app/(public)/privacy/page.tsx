/**
 * Privacy and cookie notice (product/Analytics.md §3), written as a notice
 * under India's Digital Personal Data Protection Act 2023: what we collect
 * and why, who processes it, how long we keep it, the visitor's rights and
 * how to withdraw consent. Static; the cookie choice itself is the client
 * banner, reopened by the "Cookie settings" button.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CookieSettingsButton } from "@/components/shared/consent-banner";
import { buttonVariants } from "@/components/ui/button";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy & cookies",
  description: "What SunPower Solutions collects, why, who processes it, how long we keep it, your rights, and the cookies we use.",
};

const UPDATED = "1 November 2026";

const COLLECTED = [
  {
    what: "Enquiries",
    data: "Name, mobile number, email (required on the website form), address, city and PIN code, roof and electricity details, optional business GSTIN",
    why: "To call you back, survey your roof and quote. Used only for your enquiry; never sold or used for advertising.",
  },
  {
    what: "Customers",
    data: "The above plus survey and installation photos, your signature on the completion form, serial numbers, invoices and payments",
    why: "To install your system, issue GST invoices, run the PM Surya Ghar subsidy application and honour your warranties.",
  },
  {
    what: "Warranty check",
    data: "The serial number, or your mobile number and the last 4 characters of a serial, as you type them, and your email",
    why: "To answer the check. None of it is stored; the answer hides your name, phone and address. If you raise a complaint on WhatsApp, your email is added to that message so we can reply.",
  },
  {
    what: "Staff",
    data: "Name, work email, phone, role, hourly rate and time logs",
    why: "Sign-in, scheduling and payroll.",
  },
  {
    what: "Analytics (only if you accept)",
    data: "Pages visited, clicks on buttons and links (without their text), page speed, approximate location from the IP address, device and browser; for signed-in staff, screen recordings",
    why: "To see how the site is used and fix what gets in the way. Phone numbers, emails, GSTINs and everything typed into forms are hidden before anything leaves your browser.",
  },
];

const COOKIES = [
  { name: "__Secure-authjs.session-token", type: "Essential", purpose: "Keeps staff signed in (12 hours)", where: "Cookie, staff only" },
  { name: "__Host-authjs.csrf-token, __Secure-authjs.callback-url", type: "Essential", purpose: "Protects sign-in against forgery; returns you to the page you asked for", where: "Cookie, staff only" },
  { name: "sunpower_consent", type: "Essential", purpose: "Remembers your cookie choice (12 months)", where: "Local storage" },
  { name: "sunpower_ph_opt_out", type: "Essential", purpose: "Remembers that you turned analytics off", where: "Local storage, only after rejecting" },
  { name: "sunpower:sidebar", type: "Essential", purpose: "Remembers that you collapsed the staff sidebar", where: "Local storage, staff devices only" },
  { name: "sunpower:job-draft:…", type: "Essential", purpose: "Saves a half-filled installation form on the technician's phone; cleared when the job is completed", where: "Local storage, staff devices only" },
  { name: "ph_…_posthog and other ph_… items", type: "Analytics", purpose: "PostHog: an anonymous visitor id and session so visits can be counted; set only after you accept and removed when you withdraw", where: "Cookie and local/session storage" },
];

const PROCESSORS = [
  { name: "MongoDB Atlas", role: "Database and file storage (photos, signatures)", where: "Mumbai, India" },
  { name: "Vercel", role: "Hosting; our servers run in Mumbai, pages are delivered from the nearest location", where: "India and global edge network" },
  { name: "PostHog", role: "Analytics, only with your consent", where: "United States" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

const th = "py-2 pr-4 text-left text-[13px] font-semibold text-foreground";
const td = "py-2.5 pr-4 align-top";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="text-sm font-medium text-brand-foreground">Last updated {UPDATED}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Privacy & cookies</h1>
        <p className="mt-3 text-muted-foreground">
          {COMPANY.name} ({COMPANY.address}) decides how your personal data is used on this website and in SunPower, our installation
          management system. This notice explains what we collect, why, and the choices you have.
        </p>
      </header>

      <Section title="What we collect and why">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>When</th>
                <th className={th}>What</th>
                <th className={th}>Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COLLECTED.map((row) => (
                <tr key={row.what}>
                  <td className={`${td} font-medium text-foreground`}>{row.what}</td>
                  <td className={td}>{row.data}</td>
                  <td className={td}>{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We use your enquiry and customer data because you gave it to us to get a quote and an installation, and because GST and subsidy rules
          require us to keep certain records. Analytics cookies run only with your consent, which you can withdraw at any time.
        </p>
      </Section>

      <Section title="Cookies and similar storage">
        <p>
          Essential items make the site work and are always on. Analytics items are off until you choose <strong>Accept analytics</strong>; until
          then nothing is sent to PostHog. If your browser sends Global Privacy Control or Do Not Track, we treat that as a no.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Purpose</th>
                <th className={th}>Stored in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COOKIES.map((row) => (
                <tr key={row.name}>
                  <td className={`${td} font-mono text-xs text-foreground`}>{row.name}</td>
                  <td className={td}>{row.type}</td>
                  <td className={td}>{row.purpose}</td>
                  <td className={td}>{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Business events recorded by our own servers (for example “a quote was sent”) carry no cookies and no personal details.</p>
        <CookieSettingsButton className={buttonVariants({ variant: "outline" })}>Change cookie settings</CookieSettingsButton>
      </Section>

      <Section title="Who processes your data">
        <ul className="list-disc space-y-1.5 pl-5">
          {PROCESSORS.map((p) => (
            <li key={p.name}>
              <strong className="font-medium text-foreground">{p.name}</strong>: {p.role} ({p.where}).
            </li>
          ))}
        </ul>
        <p>They process data only on our instructions. We don’t sell personal data or share it for advertising.</p>
      </Section>

      <Section title="How long we keep it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Invoices and payment records: as long as GST law requires (72 months from the annual return for the year).</li>
          <li>Installation, serial and warranty records: for the warranty period (up to 20 years for panels), so we can honour your claims.</li>
          <li>Enquiries that don’t become an order: up to 24 months, then deleted on request or in our periodic clean-up.</li>
          <li>Analytics: at most 12 months.</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>Under the Digital Personal Data Protection Act 2023 you can:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>ask what personal data we hold about you and who we shared it with;</li>
          <li>have it corrected, completed or updated, and have it erased when we no longer need it;</li>
          <li>withdraw your consent to analytics at any time, as easily as you gave it, with Cookie settings at the bottom of every page;</li>
          <li>nominate someone to exercise these rights for you;</li>
          <li>raise a grievance with us, and if you aren’t satisfied, complain to the Data Protection Board of India.</li>
        </ul>
        <p>
          Write to <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or
          call {COMPANY.phone}. We reply within 30 days.
        </p>
      </Section>
    </article>
  );
}
