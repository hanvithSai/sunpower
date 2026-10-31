# Agent_Content.md: Handoff & Working Context

> The shared brain for every human or AI agent working on SunPower OS. Read this before touching code.
> **After you finish a task, append a dated entry to the Session Log at the bottom** (what you did, files touched, open issues).

---

## 1. What we are building

**SunPower OS** is one platform for a rooftop-solar installer (SunPower Solutions, Telangana). It covers every stage from the first enquiry to the 20-year warranty. See `Plan.md` (status and owners), `product/PRD.md` and `product/Features.md`.

The lifecycle (each arrow is enforced in code by a state machine in `src/lib/workflows.ts`):

```
Enquiry (Lead) → Qualified → Survey scheduled → Survey done → Survey approved → Quote → (accepted) Order
Order: pending_payment → confirmed (payment) → ready_to_dispatch (all serials scanned) → dispatched → delivered (warranty starts, sale invoice) → installing → commissioned (signature) → closed
Service: Ticket open → assigned → in_progress → resolved → closed (customer confirmed)
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
| Next | Both | **On hold: don't start Phase 2 until the user says so.** Then: inventory (GRN + serials) → dispatch scanning → delivery (warranties + GST invoice) → installation jobs + technician "My work". | — | — |
