# Agent_Content.md: Handoff & Working Context

> The shared brain for every human or AI agent working on SunPower. Read this before touching code.
> **After you finish a task, append a dated entry to the Session Log at the bottom** (what you did, files touched, open issues).

---

## 1. What we are building

**SunPower** is one platform for a rooftop-solar installer (SunPower Solutions, Telangana). It covers every stage from the first enquiry to the 20-year warranty. See `Plan.md` (status and owners), `product/PRD.md` and `product/Features.md`.

The lifecycle (each arrow is enforced in code by a state machine in `src/lib/workflows.ts`):

```
Enquiry (Lead) → Qualified → Survey scheduled → Survey done → Survey approved → Quote → (accepted) Order
Order: pending_payment → confirmed (payment: pick list + crew free that day) → ready_to_dispatch (all serials scanned, bulk ticked)
       → dispatched (stock out, GST sale invoice) → delivered (every serial's warranty starts) → installing → commissioned (proof + signature, time logs) → closed
Service: Ticket open → assigned (service visit booked) → in_progress → resolved (₹0 + cost to the order, or auto invoice) → customer_confirmed → closed
         ("Not fixed" reopens from resolved, customer_confirmed or closed)
```

## 2. Stack & non-negotiable framework facts

- **Next.js 16.4.3 App Router**, React 19.3, TypeScript strict, Tailwind v4 (CSS-first tokens in `src/app/globals.css`), MongoDB via **Mongoose 9**, **Auth.js v5** (Credentials + JWT), Zod 4, PostHog.
- **`cacheComponents: true` is ON.** Anything that reads cookies/headers/params/searchParams or does DB I/O must render inside `<Suspense>`. `src/app/(app)/loading.tsx` already wraps every staff page, so pages may `await` at top level. Do NOT add top-level awaits in layouts. **Always call `await requireUser([...])` FIRST in a page or data loader, before any DB call or `new Date()`/`Date.now()`.** It marks the render as request-time. Public pages without a session call `await connection()` (from `next/server`) first.
- **`params` and `searchParams` are Promises:** `export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> })`.
- Do not use `export const dynamic = ...` (incompatible with Cache Components). After mutations call `revalidatePath("/leads")` etc. from `next/cache`.
- Route handlers: `{ params }: { params: Promise<{ id: string }> }`. In GET handlers access the session (`requireApiUser`) or `await connection()` before I/O.
- `proxy.ts` (not middleware.ts) guards pages. Docs: `node_modules/next/dist/docs/`.
- Server Actions have a 1 MB body limit. Uploads go through `/api/v1/files` (GridFS) instead.

## 3. Folder map & ownership

```
src/
  app/
    (public)/            landing, /enquiry, /warranty, /share/[token]   (public, no login)
    (auth)/login/        login page
    (app)/               staff app (sidebar shell); one folder per module
    api/v1/              REST endpoints (public enquiry, search, files, reports, warranty)
  components/
    ui/                  shadcn-style primitives (Button, Card, Table, Dialog, Badge, Select(native) ...)
    shared/              PageHeader, StatusBadge, ActionForm, FormField, SubmitButton, ActionButton,
                         SearchInput, FilterTabs, Pagination, EmptyState, StatCard, Section, DetailList,
                         Timeline, skeletons, MediaUploader, MediaGallery, SignaturePad, BarcodeScanner
    shell/               AppShell, command palette (⌘K)
    modules/<module>/    module-specific components (owned by that module)
  lib/                   client-safe pure logic: constants, workflows, money, gst, subsidy, warranty,
                         format, dates, navigation, validation/*  (unit-tested)
  server/
    db.ts                connectDB(), withTransaction()
    errors.ts            AppError, notFoundError, assertFound, assertTransition
    models/              ALL Mongoose models; import from "@/server/models"
    auth/                Auth.js config, session.ts (getCurrentUser, requireUser)
    lib/                 action.ts (runAction), api.ts (apiHandler, requireApiUser), validate.ts, actor.ts, rate-limit.ts
    services/core/       counters (nextNumber), activity (logActivity/listActivity), invoicing (issueInvoice),
                         stock (moveStock), files (GridFS)
    services/<module>.ts business logic per module (queries + commands)
    actions/<module>.ts  "use server" Server Actions (thin: parse → service → revalidate)
    analytics.ts         trackServer(event, props, userId)
scripts/                 db-local.ts (local Mongo), seed.ts (demo data)
tests/                   vitest unit + integration tests
```

**Rule: only edit files your task owns.** Shared files (`src/lib/*`, `src/server/models/*`, `src/server/{db,errors}.ts`, `src/server/lib/*`, `src/server/services/core/*`, `src/components/ui/*`, `src/components/shared/*`, `package.json`, `next.config.ts`) are owned by the lead. If you need a change there, write it in your final report instead of editing.

## 4. Patterns (copy these)

### Service (business logic, no auth, unit-testable)
```ts
// src/server/services/leads.ts
import { connectDB, withTransaction } from "@/server/db";
import { Lead } from "@/server/models";
import { assertTransition, notFoundError } from "@/server/errors";
import { LEAD_FLOW } from "@/lib/workflows";
import { logActivity } from "@/server/services/core/activity";
import { nextNumber } from "@/server/services/core/counters";
import type { Actor } from "@/server/lib/actor";

export async function listLeads(filter: { status?: string; q?: string; page?: number }) {
  await connectDB();                        // EVERY exported service fn starts with this
  ...  return lean() plain objects; convert ObjectIds to strings before passing to client components
}
export async function changeLeadStatus(id: string, to: LeadStatus, actor: Actor) {
  return withTransaction(async (session) => {
    const lead = await Lead.findById(id).session(session);
    if (!lead) throw notFoundError("Lead");
    assertTransition("lead", LEAD_FLOW, lead.status, to);
    ...
    await logActivity({ entityType: "lead", entityId: lead._id, customerId: lead.customerId, action: "status_changed", message: `Status changed to ...`, actor }, session);
  });
}
```
- Services must NOT import `"server-only"` (the seed script and tests import them under plain Node).
- Inside `withTransaction`, pass `session` to every query: `Model.create([doc], { session })`, `.session(session)`, `{ session }` options.
- Money is **integer paise** everywhere. Convert with `toPaise()` and format with `formatINR()`.
- Numbers: `await nextNumber("lead", session)` returns `SP-L-0001`; invoices go through `issueInvoice()`.
- Stock changes ONLY via `moveStock()`.

### Server Action (thin)
```ts
// src/server/actions/leads.ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import { parseForm } from "@/server/lib/validate";
import { QualifyLeadSchema } from "@/lib/validation/leads";
import type { ActionState } from "@/lib/action-state";

export async function qualifyLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(["sales"], async (user) => {        // admin is always allowed too
    const input = parseForm(QualifyLeadSchema, formData);  // throws field errors automatically
    await qualifyLead(input, user);
    revalidatePath(`/leads/${input.leadId}`);
    trackServer("lead_status_changed", { from, to }, user.id);
    return { ok: true, message: "Lead qualified" };
  });
}
```
To navigate after success, call `redirect()` (from `next/navigation`) inside the work callback (it is re-thrown correctly), or return `data` and let the client route.

### Page (server component)
```tsx
export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["sales", "support"]);   // FIRST line
  const sp = await searchParams;
  const data = await listLeads({ ... });
  return (<>
    <PageHeader title="Leads" description="..." actions={...} />
    ...
  </>);
}
```
- Pass only plain serialisable data to client components: strings, numbers, booleans, plain objects, Dates are OK. ObjectIds must be converted with `String(id)`.
- Forms: `<ActionForm action={serverAction} successMessage="Saved">` + `<FormField label name>` + `<Input id name>` + `<SubmitButton>`. The field error appears automatically under the matching `name`. Nested schema fields use dotted names (e.g. `measurements.tiltDeg`), and the error key matches the dotted path.
- One-click actions: `<ActionButton action={act} hiddenFields={{ id }} confirm={{ title: "Mark delivered?" }}>`.
- Lists: `SearchInput` (param `q`), `FilterTabs` (param `status`), `Pagination`; tables use `components/ui/table`. Empty lists show `EmptyState`.
- Status chips: `<StatusBadge kind="order" status={order.status} />`.
- Dates: `formatDate`, `formatDateTime`, `formatRelative` (IST). Phones: `formatPhone`, `waLink`, `telLink`.

### Validation
Module schemas live in `src/lib/validation/<module>.ts` and compose `src/lib/validation/common.ts` (`phone`, `pincode`, `rupeesAsPaise`, `requiredNumber`, `checkbox`, `stringArray`, `objectId`, `enumOf`, ...). Use the same schema on the client (`required`/`min`/`pattern` attributes for instant feedback) and the server (authoritative).

### Analytics
`trackServer(event, props, user.id)` from `@/server/analytics`, using the event names in `ANALYTICS_EVENTS` (`src/lib/constants.ts`). Never put customer phone numbers or emails in props.

## 5. Rules for parallel agents
- Do **not** run `git`, `npm install`, `next build` or `next dev`. Several agents share this folder. The lead integrates.
- Verify with `npx tsc --noEmit --incremental false` (only fix errors in YOUR files; others are mid-flight) and `npx eslint <your files>`.
- Never create or stub files owned by another agent, even if an import of theirs is missing while they work.
- Add a short explainer comment at the top of each non-trivial file. Keep functions small and named for the business action.
- Seeded demo logins (password `SunPower@2026`): director@sunpower.demo, sales@sunpower.demo, tech@sunpower.demo, warehouse@sunpower.demo, support@sunpower.demo.

## 6. Environment
- Local DB: `npm run db:local` (in-memory replica set on :27017), then `npm run seed`.
- `.env.local`: `MONGODB_URI`, `AUTH_SECRET`, `NEXT_PUBLIC_POSTHOG_KEY` (optional). Template: `.env.example`.

---

## Continuing on another device

1. `git pull` on `main` (everything is on GitHub; feature branches are merged).
2. `npm install`.
3. Create `.env.local` (it's git-ignored, so it is **not** in the repo): copy `.env.example` and set `MONGODB_URI` (the Atlas string, as in Vercel) and `AUTH_SECRET` (any 32+ byte random value locally; production uses its own).
4. `npm run dev`, sign in with the demo accounts, and run `npm test` / `npm run typecheck` to confirm the setup.
5. Read this log and `Plan.md` for status. `build-prompt.md` (the original brief) is local-only and not in git, so copy it across manually if you need it.

## Session Log

| When (IST) | Who | What | Files | Open issues |
|---|---|---|---|---|
| 31 Oct, 10:30 | Hanvith | Plan approved. Decisions: Auth.js v5, GridFS media, PostHog, Namecheap domain. | `Plan.md` | — |
| 31 Oct, 11:30 | Vamshi | Backend foundation: domain lib, 18 models, db + transactions, counters, activity log, invoicing, stock ledger, Auth.js + proxy, API/action wrappers, health check, CI, staff seed. | `src/lib/*`, `src/server/*`, `src/proxy.ts`, `scripts/*`, `.github/*` | — |
| 31 Oct, 12:10 | Hanvith | Product + engineering docs, Setup guide, design system, UI kit, app shell with ⌘K palette, login with demo accounts, module placeholders, home page, root error boundary, self-hosted Inter, WCAG contrast fixes. | `product/*`, `engineering/*`, `Setup.md`, `README.md`, `src/app/*`, `src/components/*` | — |
| 31 Oct, 12:24 | Both | **Phase 0 pushed** as feature branches, each merged into `main` by the other developer. Atlas connected; slow venue network handled (standard Atlas string locally, 30 s timeout, IPv4). | — | — |
| 31 Oct, 12:41 | Both | Live URLs recorded; `vercel.json` (Next.js framework pin), `metadataBase`, `COMPANY.website`. **From here on: commit after every logical unit under the owning developer and push small batches.** | `vercel.json`, docs | — |
| 31 Oct, 12:50 | Both | Media pipeline verified (11/11 checks on Atlas) and merged: GridFS API (Vamshi) + `MediaUploader`, `MediaGallery`, `SignaturePad`, `BarcodeScanner` (Hanvith). | `src/server/services/core/files.ts`, `src/app/api/v1/files/**`, `src/components/shared/*` | Multi-piece (>4 MB) uploads reviewed in code, not run on the venue uplink |
| 31 Oct, 13:53 | Both | **Phase 1a (leads & surveys).** Vamshi: schemas + services (dedupe, auto-assign, state machines), actions, public enquiry API + action, `scripts/check-lead-flow.ts` (10/10). Hanvith: pipeline board/table with SLA, lead detail (qualification, survey booking, quote gate), mobile survey form, review panel, `/enquiry`. Every `(app)` route folder has a `loading.tsx`. | `src/server/services/{leads,surveys,customers,users}.ts`, `src/app/(app)/{leads,surveys}/**`, `src/app/(public)/enquiry` | — |
| 31 Oct, 14:11 | Both | **Phase 1b (catalog → quotes → orders & payments).** Vamshi: catalog seed, `src/lib/quote-calc.ts`, catalog/quotes/orders/payments services + actions, `scripts/check-sale-flow.ts` (15/15). Hanvith: quote builder, quote detail/print, orders list/detail with record-payment dialog, catalog page. Demo chain: SP-L-0001 → SP-Q-0001 → SP-O-0001 (paid) → SP-J-0001. | `src/server/services/{catalog,quotes,orders,payments}.ts`, `src/app/(app)/{quotes,orders,catalog}/**` | Serialized stock is 0 until GRNs (Phase 2) |
| 31 Oct, 14:30 | Both | **Production incident fixed.** Vercel now builds `main`. Sign-in failed because the `MONGODB_URI` credentials in Vercel were rejected by Atlas (diagnosed from `/api/v1/health` timing). Variable updated and redeployed; health `db: up` on `681cea0`. | — | — |
| 31 Oct, 14:45 | Both | All documentation synced: status, incidents and lessons, env checklist, product vocabulary and number formats. | docs | Pending approvals: Vercel region → Mumbai (`bom1`); health failure reasons |
| 31 Oct, 15:00 | Both | Functions pinned to Mumbai (`bom1`, `vercel.json`). `/api/v1/health` now returns `version`, `region` and, on failure, a safe `reason` (`src/server/lib/db-errors.ts`, verified against real Atlas errors). First unit tests (`tests/unit/db-errors.test.ts`, 6). Vitest config is now `vitest.config.mts` with native tsconfig paths; `vite-tsconfig-paths` removed. | `vercel.json`, `src/app/api/v1/health/route.ts`, `src/server/lib/db-errors.ts`, `tests/`, `vitest.config.mts`, docs | — |
| 31 Oct, 16:55 | Both | **Phase 2 (operations).** Vamshi: inventory service (GRN with a cost per serial, stock value, serial register), dispatch service (scan guards, auto "Packed", `DISPATCH_INCOMPLETE` gate, sale invoice at dispatch, warranties on delivery), crew booking that never double-books (`core/crew.ts`), jobs service (start gate, BR-14 completion, time logs, extras to stock + order costs), seeded GRNs (181 serials), `scripts/check-ops-flow.ts` (46/46), form-schema unit tests. Hanvith: stock / serial register / GRN form (camera + paste), dispatch queue + packing bench, My work, crew calendar (clash highlights), job page with completion form + signature, printable certificate with serial and workmanship warranties. | `src/server/services/{inventory,dispatch,jobs}.ts`, `src/server/services/core/crew.ts`, `src/app/(app)/{inventory,dispatch,jobs,my-work}/**`, `scripts/check-ops-flow.ts`, `scripts/flows/order.ts` | Dev server occasionally keeps a stale service module: restart `npm run dev` after pulls |
| 31 Oct, 17:40 | Hanvith | Code walkthrough added (`engineering/Codebase.md`: one order end to end, modules, files, key functions, who built what, at `b799ac3`). README status, quick start and highlights synced with Phase 2. | `engineering/Codebase.md`, `README.md`, `Plan.md` | Snapshot at Phase 2: Phase 3 and 3b are not in it yet |
| 31 Oct, 18:40 | Both | **Phase 3 (service, finance, insight).** Vamshi: ticket states with `customer_confirmed`, workmanship warranty, ticket service (₹0 repairs charged to the order, auto service invoice, replacements inherit cover, billing override), `/api/v1/search`, costing from actuals, dashboard aggregations (unfinished steps, advances held), subsidy stages, share links, payroll, profit/payroll CSV, full seed (121 installations of history + live pipeline through the services), `check-service-flow` (29/29) and `check-finance-flow` (21/21). Hanvith: service desk (warranty-first raise-ticket page, ticket actions by state), dashboard with validated trend chart and share panel, masked `/share/[token]`, invoices + printable GST invoice, subsidy board + order stepper, costing card, team payroll. 33 unit tests; production build green. | `src/server/services/{tickets,search,costing,dashboard,finance}.ts`, `src/app/(app)/{service,dashboard,invoices,subsidy,team}/**`, `src/app/(public)/share/**`, `scripts/seed/{history,pipeline,people}.ts` | — |
| 31 Oct, 19:15 | Both | Pushed; Vercel deployed `2620e01` (health `db: up`, `bom1`). **Atlas seeded** and verified on production (search, warranty badges, 12-month trend, loss-makers, dispatch queue). Lesson: the first seed went to the local DB because `.env.local` points there; Setup.md §6 now shows how to target Atlas. Docs synced. | docs | `/warranty` (⌘K "Check warranty") and `/customers` not built yet |
| 31 Oct, 20:30 | Both | **Phases 0–3 verified and finished (local, not pushed).** Audit of R-01…R-73 and every plan row against the code found: `/warranty` 404 (linked five times), `/customers` placeholder, no Panel Sets, no missing-parts check (R-24), no business GSTIN (R-03), no technician filter (R-07), no stock correction or serial history (F10), Phase 3b unbuilt. Vamshi: `services/warranty.ts` + `POST /api/v1/warranty` + `lookupWarrantyAction`; `listCustomers` / `getCustomer360`; `panel_set` system type (no crew without the installation line, delivered → closed); `missingComponents` + `sendWithMissing`; GSTIN on enquiries; certificate share links (`scope: certificate`, `?share=` photo access, profit CSV refuses them); subsidy papers + `feasibilityPending`; invoice/ticket CSVs with a formula guard; `adjustStock` / `writeOffSerial`; flow checks now 148, unit tests 55. Hanvith: `/warranty` page, `/customers` + `/customers/[id]`, Panel Sets in builder/catalog/order stepper, missing-parts warning, GSTIN field, `CertificateView` shared by staff and `/share/[token]`, WhatsApp certificate card, subsidy papers dialog, feasibility banners, `ParamSelect`, CSV buttons, stock correction dialogs, serial history. | `src/server/services/{warranty,customers,finance,inventory,quotes,payments,dispatch,jobs}.ts`, `src/app/(public)/{warranty,share}`, `src/app/(app)/{customers,orders,jobs,quotes,inventory,service,invoices,subsidy}/**`, `scripts/seed/{catalog,pipeline}.ts`, `tests/unit/*` | Not pushed. After pushing, re-run the seed on Atlas (Human_Tasks #18). `COMPANY.whatsapp` is a placeholder (#19). `next dev` may need a restart to pick up new service exports (Engineering incident 8) |
| 31 Oct, 22:45 | Both | **Phase 4 (hardening).** Vamshi: workmanship rule moved to `lib/warranty.ts`; costing maths to `lib/costing.ts` and crew picking to `lib/crew.ts` (services now call them); warranty expiry cut-off fixed (covered while now ≤ end, same as billing); unit tests for quote maths, state machines, warranty dates, costing and crews (121 in all); `lib/analytics.ts` event contract, `maskContactText`, `onRequestError` server errors, `captureImmediate` sends. Hanvith: `instrumentation-client.ts` (PostHog, privacy-first), identify on sign-in / reset on sign-out, search and scan-method events, `$exception` from error boundaries, `.ph-no-capture` on addresses and signatures, F23 job-form draft in `localStorage`, WCAG AA colour tokens, a11y names, 360 px detail pages, `global-error.tsx`. Pushed, production on `ba6fbab`. | `src/lib/{analytics,analytics-client,costing,crew,warranty}.ts`, `src/instrumentation*.ts`, `src/server/analytics.ts`, `src/components/modules/jobs/complete-job-form.tsx`, `src/app/globals.css`, `tests/unit/*` | PostHog key added in Vercel and verified on production (#8). Old drafts live per job under `sunpower:job-draft:<jobId>`. `engineering/Codebase.md` now describes `ba6fbab` (Phases 0–4) |
| 1 Nov, 00:45 | Hanvith | **Analytics and privacy.** `src/lib/consent.ts` (choice in `sunpower_consent`, 12 months, versioned; GPC/DNT = no); PostHog config moved to `src/lib/analytics-client.ts` (`startAnalytics` / `stopAnalytics`), started from `instrumentation-client.ts` only with consent; `ConsentBanner` + `CookieSettingsButton` (root layout, public footer, account menu); public `/privacy`. Masked autocapture (`mask_all_text`, `mask_all_element_attributes`) with `cta()` labels on 14 CTAs, heatmaps (URL keys scrubbed), rage/dead clicks, web vitals (nested URLs scrubbed). 128 unit tests. | `src/lib/{consent,analytics,analytics-client}.ts`, `src/instrumentation-client.ts`, `src/components/shared/consent-banner.tsx`, `src/app/(public)/privacy/page.tsx`, `product/Analytics.md` | Locally, analytics need a click on Accept; use a dummy key so dev clicks don't reach production. New CTAs: add the name to `CTAS` and spread `cta()` on the element. Privacy notice needs a business review (Human_Tasks #21) |
| 1 Nov, 02:30 | Hanvith | **Redesign on `feat/energy-redesign` (not merged).** Tokens in `globals.css` (forest, primary #1D5C40, `sun`, `volt` — not `current`, which Tailwind reserves for currentColor), fonts in `src/app/fonts`, new `Logo`/`LogoMark`; `EnergyFlow`, `SubsidyEstimator`, rebuilt `(public)/page.tsx` and public layout; `navigation.ts` (lifecycle sections, `hint`, shared `QUICK_ACTIONS`, `activeNavItem`); forest `SidebarNav`, `AppShell` (collapse, location, New menu); `getPipeline` + `LifecyclePipeline` on the dashboard; sign-in panel; Style_Guide v2; docs rebranded. | `src/app/globals.css`, `src/components/{brand,shell}/*`, `src/components/modules/{public,dashboard}/*`, `src/lib/navigation.ts`, `src/server/services/dashboard.ts` | Review on the branch before merging. On Windows, `sed -i` edits can be missed by the dev server's watcher: rewrite the file or restart `next dev` |
| 1 Nov, 03:45 | Hanvith | **Redesign merged to `main`.** Follow-ups: `PageTransition` + `view-transition-guard.ts` (installed in `instrumentation-client.ts`), `CountUp`, `ScrollColumn` (five cards, then scroll), `PackageDialog`, `PanelGridGlow`, `AccountMenu` in the sidebar (top-bar menu removed), `getReports` + `/reports` + `report-charts.tsx` (validated categorical palette), restyled `/subsidy`, Hybrid removed from `EnergyFlow`. | `src/components/shared/*`, `src/components/shell/*`, `src/components/modules/{public,reports,quotes}/*`, `src/server/services/reports.ts`, `src/app/(app)/{reports,subsidy,catalog}/*` | Client chart components take named formats, not functions (server pages can't pass functions). Background-tab navigations skip the transition by design |
| 1 Nov, 07:00 | Vamshi | **Demo coverage seed.** `scripts/seed/coverage/*` (sections behind `seed:cov:*`; `daily.ts` saves progress per day in `seed:daily`), `scripts/seed/photos.ts` (procedural JPEGs via `sharp`, uploaded once as `seed-*.jpg`, plus `signatureDataUrl`), `insertInstallations` extracted from `seedHistory` (tags keep serials and supplier invoice numbers unique), `scripts/check-demo-data.ts`. Seeded on Atlas; all checks pass. | `scripts/seed/**`, `scripts/check-demo-data.ts`, `package.json` | Re-run the seed on demo morning (#22). Signatures need Windows handwriting fonts. A sale invoice can never be wholly unpaid (issued after the advance), so that filter combination stays empty by design. Photo captions show the shared file's upload date |
| Next | Both | Re-run the seed on demo morning (#22); real WhatsApp number (#19); Phase 5: bug bash on production, final docs pass and freeze, demo video (Plan.md §8). | — | — |
