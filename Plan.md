# SunPower OS — Master Plan

> **This file is the single source of truth.** It tracks status, ETA, owners, and what is done or left.
> Update it before every commit. Status legend: ⬜ Todo · 🟨 In progress · ✅ Done · ⛔ Blocked · ✂️ Cut

| | |
|---|---|
| **Product** | SunPower OS: one platform that takes a customer from the first enquiry to the 20-year warranty |
| **Event** | Odoo x GCET Hackathon 2026 (Team 19) |
| **Build window** | 12 working hours (T+0 → T+12). Coding hard-stops **01 Nov, 10:00 AM** |
| **Hard external deadline** | ⚠️ Add evaluator (`gppa-odoo`, `hackathon-odoo`) as GitHub collaborator by **31 Oct, 11:00 AM** |
| **Team** | Hanvith Sai Alla (`hanvithSai`): Product, Architecture, Frontend · Lagishetty Vamshi (`LV2402`): Backend, DB, Integration, Tests |
| **Stack** | Next.js 16.4.3 (App Router, TS) · MongoDB Atlas + Mongoose · Tailwind v4 + shadcn/ui · Vercel · GitHub Actions |
| **Live URLs** | Production: https://www.sunpowersolutions.me (apex `sunpowersolutions.me` redirects to www) · Vercel: https://sunpowersolutions.vercel.app |

---

## 1. Problem → Solution (PM view)

SunPower runs about 40 installs a month with 15 technicians, and it runs them on WhatsApp, paper registers and memory. Every scene in the brief has the same cause: **there is no single record that follows the customer from stage to stage**, so each hand-off loses information.

**Product thesis:** treat each customer as **one Project record that moves through a state machine**:
`Enquiry → Qualified → Survey → Quote → Order → Dispatch → Installation → Commissioned → Warranty/Service`.
Each module is a view of that one record. The system enforces the gates, so they don't depend on people remembering.

| Scene from the brief | Pain today | What we build | "Wow" moment for the demo |
|---|---|---|---|
| Rooftop inquiry | Leads vanish across WhatsApp, calls and forms | Public enquiry form, plus manual entry tagged with its source (WhatsApp, Call, Walk-in, Web). Leads land in a Sales pipeline with an SLA timer | Submit the form on a phone and it appears in the pipeline right away with a red "uncontacted 2h" badge |
| Qualification + survey | Calls and surveys go unrecorded | Qualification checklist (shadow-free roof area, monthly bill, grid suitability) leading to a survey on the technician's phone (direction, tilt, cable distance, shading, photos). Approval gate | The "Create Quote" button stays **locked until the survey is approved** |
| Getting the kit right | Quotes are typed by hand and parts get missed | Package templates (1–5 kW × On-Grid/Off-Grid). Picking a template **auto-expands the full BOM**. PM Surya Ghar subsidy and GST are calculated automatically. Printable quote | Pick "3 kW On-Grid" and all 14 line items appear, with net price after subsidy |
| Order + payment | The warehouse and crew are told by phone | Accepting a quote creates an Order. Recording an advance or full payment **auto-creates a pick list and an installation job** on the crew calendar | One click and the warehouse and the crew calendar both update |
| Dispatch + serials | Serials on paper are lost by the time a warranty claim comes | Dispatch screen with **camera barcode scan or manual entry**. Each serial is checked against the SKU and stock. Dispatch is blocked until every serialized item is scanned | The truck can't leave with a missing serial. **Delivery starts every warranty clock** (2y inverter/battery, 20y panels) |
| On the roof | Site registers, photos scattered on phones | Mobile-first job form: start/finish time, confirmed kW, photos, **on-screen customer signature**. Generates an installation certificate | The homeowner signs on the tablet and the job closes with proof |
| Rainy-season breakdown | Can't find the customer or the serial | **Global ⌘K search** by phone, name or serial in under 1 second. Warranty status shown live. Ticket lifecycle runs until the customer confirms the fix. Out-of-warranty work is **billed automatically** | Type the last 4 digits of a serial and see "In warranty, 6 months left" and a ₹0 ticket |
| Director's month-end | No P&L visibility | Dashboard for today, this week and this month: revenue, cash collected, **profit per job** (revenue − BOM cost − technician hours × rate − extras), open repairs, stuck projects, subsidy pipeline. **Shareable read-only link** and CSV export | "Which jobs lost money?" is answered with one sorted table |

---

## 2. Consultant recommendations (how we win)

1. **Judges are from Odoo, so mirror Odoo's integrated-ERP mental model.** CRM → Sales → Inventory → Field Service → Helpdesk → Accounting, all on one record. Integration across modules beats depth in any single module, so show the **chained automations** (quote accepted → pick list + job; delivered → warranties; ticket out-of-warranty → invoice).
2. **Enforce the process; don't just record it.** Gates (no quote before survey, no dispatch before all serials are scanned) are the clearest proof that we solved *their* problem, not just built CRUD screens.
3. **Depth over breadth in the demo path.** One golden path, Enquiry → Warranty claim, must be flawless end to end. Each secondary module needs only a list, a detail page and the one action that matters.
4. **Explicit scope cuts** (to avoid the 12-hour trap): no payment gateway (record payments manually), no WhatsApp Business API (use free `wa.me` click-to-chat deep links instead), no SMS, no native app (a responsive PWA-style technician view instead), no multi-company setup, no full accounting ledger.
5. **India-ready by default:** ₹ in the lakh format (₹1,50,000), GSTIN on invoices, PM Surya Ghar subsidy tracker, DISCOM net-metering stages, Telangana seed data.
6. **Meet the event's must-haves on purpose:** dynamic DB-backed data (no static JSON), Zod validation on client and server, a responsive and consistent UI, and **commits from both members** throughout the day.
7. **Ship deployable from hour 1.** Get a skeleton onto Vercel early, with lint + typecheck + build CI. Late deploy surprises are the #1 hackathon killer.

---

## 3. Users & roles (RBAC)

| Role | Persona (seeded) | Main screens |
|---|---|---|
| **Admin / Director** | Rajesh Reddy, Founder | Dashboard, P&L, settings, users, share links |
| **Sales** | Priya Sharma | Leads pipeline, qualification, quotes, orders, payments |
| **Technician** (surveyor + installer) | Ravi Kumar (+14 more) | My Jobs (mobile): surveys, installations, service visits |
| **Warehouse** | Suresh Yadav | Stock, purchases (GRN), pick lists, dispatch scanning |
| **Support** | Anjali Rao | ⌘K search, tickets, warranty lookup |
| **Customer** (public, no login) | Homeowner | Enquiry form, warranty lookup by serial/phone, project status link (nice-to-have) |

---

## 4. Feature backlog (MoSCoW, prioritised)

**P0 = Must (demo path) · P1 = Should · P2 = Could (only if ahead of schedule)**

| ID | Module | Feature | Pri | Owner (BE / FE) |
|---|---|---|---|---|
| F01 | Platform | Auth (email+password, JWT cookie, `proxy.ts` route guard), RBAC by role | P0 | Vamshi / Hanvith (login UI) |
| F02 | Platform | App shell: sidebar, top bar, ⌘K search, role-aware nav, toasts, empty/loading/error states | P0 | — / Hanvith |
| F03 | Leads | Public enquiry form → Lead (source, kW need, subsidy interest), validation, rate limit | P0 | Vamshi / Hanvith |
| F04 | Leads | Pipeline (kanban + table), manual lead entry with source tag, SLA "uncontacted" badge, activity timeline, `wa.me`/`tel:` actions | P0 | Vamshi / Hanvith |
| F05 | Leads | Qualification checklist (roof area, bill, grid, shadow) → qualify / reject with reason | P0 | Vamshi / Hanvith |
| F06 | Survey | Assign survey to technician; mobile survey form (direction, tilt, cable distance, shading, photos); approve/reject | P0 | Vamshi / Hanvith |
| F07 | Catalog | Products (serialized vs bulk, cost, price, warranty months, HSN, GST %), package templates with BOM | P0 | Vamshi / Hanvith |
| F08 | Quote | Quote from template → auto BOM, editable lines, subsidy + GST calc, versioning, print/PDF view; **gate: survey approved** | P0 | Vamshi / Hanvith |
| F09 | Order | Accept quote → Order; record payments (advance/full, mode: UPI/NEFT/Cash/Cheque); auto pick list + installation job | P0 | Vamshi / Hanvith |
| F10 | Inventory | Stock levels per product, serial register (in-stock / dispatched / installed / replaced / RMA), purchase receipt (GRN) with serial entry, low-stock alerts | P0 | Vamshi / Hanvith |
| F11 | Dispatch | Pick list → scan serials (camera barcode + manual), validation, **block until complete**, mark delivered → **auto warranty start** | P0 | Vamshi / Hanvith |
| F12 | Installation | Crew calendar/schedule, assign technicians; mobile job form: start/finish, confirmed kW, photos, **signature pad**; completion certificate | P0 | Vamshi / Hanvith |
| F13 | Service | ⌘K search (phone/name/serial/project no.), warranty status card, ticket lifecycle (Open → Assigned → In Progress → Resolved → Customer Confirmed → Closed), in-warranty = ₹0, out-of-warranty → auto invoice for parts + labour, serial replacement | P0 | Vamshi / Hanvith |
| F14 | Finance | Invoices (GST, GSTIN, ₹ format), payment status, job costing (BOM cost + labour hours × rate + extras) | P0 | Vamshi / Hanvith |
| F15 | Dashboard | Today/week/month KPIs, profit per job table (sortable, losers highlighted), open repairs, stuck/unfinished projects, revenue trend chart | P0 | Vamshi / Hanvith |
| F16 | Subsidy | PM Surya Ghar tracker per project: Applied → Feasibility → Net-meter installed → Inspected → Subsidy disbursed (with dates + docs) | P1 | Vamshi / Hanvith |
| F17 | Dashboard | Share: signed read-only link (expiring) + CSV export | P1 | Vamshi / Hanvith |
| F18 | Payroll-lite | Technician hours log per job → monthly payout summary | P1 | Vamshi / Hanvith |
| F19 | Platform | Audit log / activity timeline on every record | P1 | Vamshi / Hanvith |
| F20 | Public | Customer warranty lookup page (serial or phone + OTP-less last-4 check) | P1 | Vamshi / Hanvith |
| F21 | Notifications | Email via Resend free tier (lead received, quote sent, ticket updates) | P2 | Vamshi / — |
| F22 | Public | Customer project tracking link | P2 | Vamshi / Hanvith |
| F23 | Technician | Offline-tolerant job form (draft saved locally, sync when online) | P2 | — / Hanvith |

---

## 5. Architecture (summary, full detail in `engineering/Architecture.md`)

```
Browser (desktop + technician mobile)
   │  RSC pages (reads) · Server Actions (mutations) · /api/v1 (public + integrations)
   ▼
Next.js 16 on Vercel ── proxy.ts (auth + RBAC guard)
   │
   ├─ src/app/            UI routes             ← Hanvith
   ├─ src/components/     UI + design system    ← Hanvith
   ├─ src/app/api/v1/     Route handlers        ← Vamshi
   ├─ src/server/actions/ Server actions (thin) ← Vamshi
   ├─ src/server/services/ Business logic + state machines + automations ← Vamshi
   ├─ src/server/models/  Mongoose schemas      ← Vamshi
   └─ src/lib/schemas/    Zod schemas + shared types (THE CONTRACT) ← Vamshi writes, Hanvith reviews
   ▼
MongoDB Atlas (free M0) ── images: compressed client-side, stored in GridFS
```

**Key decisions**
- **Server Actions plus a services layer.** UI never touches models directly, so business rules sit in one place and are unit-testable.
- **Zod schemas are the shared contract.** The same schema validates the form (react-hook-form) and the server, so contract drift can't happen.
- **State machines in services** (`lead`, `project`, `ticket`). Illegal transitions throw typed errors, and the UI shows them as toasts.
- **Automations as service-level side effects inside Mongo transactions**: order confirmed → pick list + job; delivered → warranties; ticket resolved out of warranty → invoice.
- **Money stored as integer paise** to avoid float rounding errors in ₹ totals.
- **Auth:** ✅ decided: **Auth.js v5**, using the Credentials provider and JWT sessions that carry the role. Passwords are bcrypt hashes in `users`. It's a maintained, widely used library with Next 16 support, so we don't hand-roll security.
- **Photos & videos in GridFS:** ✅ decided. No extra vendor account. Images are compressed in the browser, and large files go up in ~4 MB pieces, staying under Vercel's 4.5 MB request limit and Atlas M0's 512 MB.
- **Open-source / free only:** Radix + shadcn-style UI, lucide-react, Recharts, Zod, `@zxing/browser` (barcode), `signature_pad`, Vitest, GitHub Actions, Vercel Hobby, **PostHog free tier** (✅ decided: analytics + error tracking).

### Core collections (full schemas in `engineering/DB.md`)
`users` · `customers` · `leads` · `surveys` · `products` · `packages` (BOM templates) · `quotes` · `orders` · `payments` · `stockMoves` · `serialUnits` · `pickLists` · `jobs` · `warranties` · `tickets` · `invoices` · `subsidyApplications` · `timeLogs` · `shareLinks` · `activities` · `counters` (human-readable numbers such as `SP-Q-2026-0142`)

---

## 6. Seed data (real DB, India-specific, every feature demo-able)

Run with `npm run seed` (idempotent; wipes and reseeds). It covers **about 14 months of history** so that out-of-warranty cases exist.

- **Users:** 1 director, 2 sales, 15 technicians, 1 warehouse, 1 support (Telugu, Hindi, Tamil and other Indian names; `+91` numbers). Demo logins are documented in `Setup.md`.
- **Catalog:** panels (Waaree, Adani, Tata Power Solar 540–550 Wp), inverters (Growatt, Sungrow, Luminous, Havells), batteries (Exide, Luminous), charge controllers, ACDB/DCDB, earthing kits, GI stands, DC/AC cable, MC4 connectors, lightning arrestors. Realistic ₹ costs and prices, HSN codes and warranty months.
- **Packages:** 10 templates (1/2/3/4/5 kW × On-Grid/Off-Grid), each with a full BOM.
- **Customers and projects (~150):** Hyderabad, Secunderabad, Gachibowli, Kukatpally, LB Nagar, Warangal, Karimnagar, Nizamabad, Khammam; homes plus a few small factories. DISCOM: TSSPDCL / TSNPDCL.
- **Spread across every stage:** new leads (some breaching SLA), qualified, rejected (shaded roof), survey pending/approved, quotes draft/sent/accepted, orders with advance only vs fully paid, awaiting dispatch, in installation, commissioned.
- **Service:** tickets in every status. Some in warranty (₹0), some out of warranty with auto invoices (inverters installed more than 2 years ago are seeded via backdated legacy projects).
- **Finance:** profitable and **loss-making jobs** (rework, extra cable, overtime), subsidy applications at every stage, unpaid invoices.

---

## 7. Collaboration model (avoid merge conflicts by design)

**Branching:** `main` (protected, always deployable) ← short-lived `feat/<area>-<name>` branches ← PRs reviewed by the other dev → squash-free merge (keeps both authors' commits visible).

**Conflict avoidance rules (agreed up front)**
1. **Directory ownership:** Hanvith owns `src/app/(app|public)/**`, `src/components/**` and `product/`. Vamshi owns `src/server/**`, `src/app/api/**`, `src/lib/schemas/**`, `scripts/seed/**`, `tests/**` and `engineering/DB.md` + `API.md`.
2. **Contract first:** Vamshi lands each module's Zod schema + service signatures (stubs allowed) **before** Hanvith builds its UI. Hanvith codes against the types.
3. **Shared files have one owner each:** `package.json` (Vamshi; Hanvith asks before adding deps), `globals.css` / design tokens (Hanvith), `Plan.md` / `Agent_Content.md` (whoever finishes a task appends their own row; rebase before push).
4. **Rebase on `main` at the start of every task**, and keep PRs small (< 400 lines).
5. **Commit identity per dev:**
   - Hanvith: `git -c user.name="Hanvith Sai Alla" -c user.email="hanvithsai.a@gmail.com"`, with a 6–8 word, past-tense message, e.g. *"Built quote builder with automatic BOM expansion"*
   - Vamshi: `git -c user.name="Lagishetty Vamshi" -c user.email="vamshi.lagishetty24@gmail.com"`, with a 3–4 word, simple message, e.g. *"add quote service"*
   - **No AI / Co-Authored-By tags in any commit or PR.**

---

## 8. Timeline, owners & ETA (12 hours)

Times are relative to the kickoff (T+0). Each phase ends with a merge to `main`, a Vercel deploy, and a Plan.md update.

### Phase 0: Foundation (T+0:00 → T+1:30)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 0.1 | Docs: `product/*` (6), `engineering/*` (4), `Setup.md`, `Human_Tasks.md`, `Agent_Content.md`, `README.md` | Hanvith (DB/API docs: Vamshi) | `docs/product-plan`, `docs/engineering` | ✅ |
| 0.2 | Design system: Apple-style tokens, Inter, UI kit (Radix), app shell + sidebar + ⌘K palette, login with demo accounts, module placeholders | Hanvith | `feat/ui-shell` | ✅ |
| 0.3 | Domain lib (enums, state machines, money, GST, subsidy, warranty, IST dates, validation), Mongo connection + transactions, all 18 models, counters, audit log, invoicing, stock ledger | Vamshi | `feat/domain-lib`, `feat/db-core` | ✅ |
| 0.4 | Auth.js v5 (Credentials + JWT roles), `proxy.ts` guard, role-based nav, `/api/v1/health`, staff seed (20 accounts in Atlas) | Vamshi | `feat/auth`, `feat/seed-users` | ✅ verified on Atlas: sign-in, role landing pages, role redirects, 404 |
| 0.5 | CI (lint, typecheck, test, build) on every PR + push to main; Vercel deploy | Vamshi | `chore/ci`, `chore/deployment-config` | ✅ CI green on GitHub · 🟨 Vercel project + domains live, but the app isn't building from Git yet (Human_Tasks #6) |
| 0.6 | 👤 Human: evaluator collaborators, Atlas URI, Vercel link, domain | Hanvith / Vamshi | — | ✅ collaborators · ✅ Atlas · ✅ domain · 🟨 Vercel Git connection |

### Phase 1: Sales core (T+1:30 → T+4:00), golden path part 1
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 1.1 | Schemas + services: lead, customer, qualification, survey (state machine) | Vamshi | `feat/leads-api` | ✅ (flow check: scripts/check-lead-flow.ts) |
| 1.2 | Public enquiry form, pipeline kanban/table, lead detail + timeline, qualification UI, survey mobile form + review | Hanvith | `feat/leads-ui` | ✅ |
| 1.3 | Schemas + services: products, packages/BOM, quote (calc engine: subsidy, GST, paise), order, payments + automations | Vamshi | `feat/catalog-quotes-api` | ✅ (flow check: scripts/check-sale-flow.ts, 15/15) |
| 1.4 | Survey mobile form, quote builder (template → BOM), printable quote, order + payment UI, catalog | Hanvith | `feat/leads-ui`, `feat/quotes-ui` | ✅ |
| 1.5 | Seed v1: users, catalog (30 products, 10 packages, opening stock) — leads/orders at all stages come with the full seed (3.5) | Vamshi | `feat/catalog-quotes-api` | ✅ users + catalog · ⬜ pipeline data |

### Phase 2: Operations (T+4:00 → T+7:00), golden path part 2
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 2.1 | Inventory: stock moves, serial units, GRN, pick lists, dispatch validation, delivery → warranty automation | Vamshi | `feat/inventory-api` | ⬜ |
| 2.2 | Stock, GRN and serial register screens; dispatch scanner (camera + manual) | Hanvith | `feat/dispatch-ui` | ⬜ |
| 2.3 | Jobs: scheduling, technician assignment, time logs, completion + signature + photo upload (GridFS) | Vamshi | `feat/jobs-api` | ⬜ |
| 2.4 | Crew calendar, "My Jobs" mobile view, installation form, signature pad, certificate | Hanvith | `feat/jobs-ui` | ⬜ |

### Phase 3: Service, finance, insight (T+7:00 → T+9:30)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 3.1 | Global search index, tickets state machine, warranty check, out-of-warranty auto invoice, serial replacement | Vamshi | `feat/service-api` | ⬜ |
| 3.2 | ⌘K search, ticket list/detail, warranty card | Hanvith | `feat/service-ui` | ⬜ |
| 3.3 | Invoices, job costing, dashboard aggregations (today/week/month), subsidy tracker, share links + CSV | Vamshi | `feat/finance-api` | ⬜ |
| 3.4 | Director dashboard (KPIs, charts, P&L table), invoices, subsidy board, share view | Hanvith | `feat/dashboard-ui` | ⬜ |
| 3.5 | Seed v2: full history, tickets, invoices, loss-making jobs, subsidy stages | Vamshi | `feat/seed` | ⬜ |

### Phase 4: Hardening (T+9:30 → T+11:00)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 4.1 | Unit tests (Vitest): quote calc, state machines, warranty dates, costing. API tests for key routes | Vamshi | `test/core` | ⬜ |
| 4.2 | E2E (Playwright): golden path smoke test; CI runs tests on PR + deploys `main` | Vamshi | `test/e2e` | ⬜ |
| 4.3 | Analytics (PostHog/Umami free) + monitoring (Sentry free + Vercel logs), product events per `product/Analytics.md` | Hanvith | `feat/analytics` | ⬜ |
| 4.4 | UX polish: responsive pass, empty states, a11y, loading skeletons | Hanvith | `feat/ui-polish` | ⬜ |

### Phase 5: Demo readiness (T+11:00 → T+12:00)
| # | Task | Owner | Status |
|---|---|---|---|
| 5.1 | Bug bash on production URL (both devs swap roles) | Both | ⬜ |
| 5.2 | Final docs pass (README, Setup, API, DB, Architecture), Plan.md frozen | Both | ⬜ |
| 5.3 | Demo script + video recording (submission due 01 Nov, 10:30 AM) | Hanvith | ⬜ |

**Buffer rule:** if a phase overruns by more than 30 minutes, cut P1/P2 items from the end of the backlog. P0 golden-path items are never cut.

---

## 9. Demo script (5 minutes, golden path)

1. A customer submits an enquiry on a phone; it **appears in the pipeline** (Sales).
2. Sales qualifies the lead and assigns a survey. The technician fills in the survey on mobile and Sales approves it, which **unlocks the quote**.
3. Sales builds a quote from "3 kW On-Grid": the **BOM auto-fills** and the subsidy and GST are calculated. Sales records the advance, which **creates the pick list and the job**.
4. The warehouse scans serials (missing ones are blocked), dispatches and marks the order delivered, which **starts the warranties**.
5. The technician completes the job: times, photos, **customer signature**.
6. Support uses ⌘K to find a serial, sees it is in warranty, and raises a ₹0 ticket. They then show an out-of-warranty case where the **invoice is generated automatically**.
7. The director opens the dashboard: **profit per job** with losers highlighted, open repairs, then shares a read-only link.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Next 16 API differences | Read `node_modules/next/dist/docs` before each new API (e.g. `proxy.ts` replaces `middleware.ts`) |
| Atlas M0 limits (512 MB, connections) | Cached global connection, compressed images, lean seed |
| Vercel serverless timeouts | Keep aggregations indexed; seed runs locally, not on Vercel |
| Camera scan unsupported on some devices | Manual serial entry fallback always visible |
| Merge conflicts | Directory ownership + contract-first + small PRs (Section 7) |
| Scope creep | MoSCoW is enforced; the P0 golden path comes first |

---

## 11. Decisions (resolved 31 Oct)

1. **Auth:** Auth.js v5 (Credentials + JWT).
2. **Photo & video storage:** MongoDB GridFS with chunked uploads.
3. **Analytics:** PostHog Cloud free tier.
4. **Domain:** Namecheap. The domain name is still to be shared (Human_Tasks #7).
5. **Window:** coding wraps up well before the 01 Nov 10:00 AM cut-off. Each phase ends with a review checkpoint: commits from both developers, one push, then review.

---

## 12. Progress log

| Time | Who | Update |
|---|---|---|
| 31 Oct, 10:30 | Hanvith | Plan drafted and reviewed. Decisions: Auth.js v5, GridFS media, PostHog, Namecheap |
| 31 Oct, 11:00 | Hanvith | Evaluators added as GitHub collaborators |
| 31 Oct, 11:30 | Vamshi | Domain lib, 18 Mongo models, core services, Auth.js + proxy, health check |
| 31 Oct, 12:10 | Hanvith | Product docs (PRD, features, personas, analytics, style guide, requirements), engineering docs, Setup guide, design system, app shell, login |
| 31 Oct, 12:20 | Vamshi | Atlas connected; 20 staff accounts seeded; sign-in and role routing verified. Venue network is slow (DNS 2–7 s per lookup), so the local env uses the standard Atlas string |
| 31 Oct, 12:30 | Both | **Phase 0 complete:** lint, typecheck, build green; WCAG contrast fixes; self-hosted Inter; pushed for review |
| 31 Oct, 13:00 | Both | Domains live (www.sunpowersolutions.me, sunpowersolutions.vercel.app). Both currently return Vercel `NOT_FOUND` because Vercel has no Git deployment of `main`. Added `vercel.json` (framework pin) + `metadataBase`; fix steps in Human_Tasks #6 |
| 31 Oct, 14:00 | Both | Phase 1a done: enquiries (web form + API, dedupe, auto-assign), pipeline board/table with SLA, qualification, survey booking, mobile survey form with photos, review gate → quote unlocked. Verified end to end on Atlas |
| 31 Oct, 15:30 | Both | Phase 1b done: catalog seed, quote builder (package → full BOM, live GST/subsidy/margin), quote detail/print/WhatsApp, accept → order, payments (first payment confirms → pick list + installation job with least-loaded crew). Verified on Atlas |
| Next | Both | Phase 2: inventory (GRN + serials) → dispatch scanning → delivery/warranty → installation jobs & technician app. Media pipeline (GridFS uploads, signature, scanner) is drafted and gets finished and verified in Phase 2 |
