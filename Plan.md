# SunPower OS — Master Plan

> **This file is the single source of truth.** It tracks status, ETA, owners, and what is done or left.
> Update it before every commit. Status legend: ⬜ Todo · 🟨 In progress · ✅ Done · ⛔ Blocked · ✂️ Cut

| | |
|---|---|
| **Product** | SunPower OS: one platform that takes a customer from the first enquiry to the 20-year warranty |
| **Event** | Odoo x GCET Hackathon 2026 (Team 19) |
| **Build window** | 24-hour event: 31 Oct 10:00 → **01 Nov 10:00 (coding hard-stop)**. Re-baselined at 31 Oct 15:10 with clock times (section 8): golden path by 00:30, brief-complete by 04:00, freeze 08:30, video submitted by 10:30 |
| **Hard external deadline** | ⚠️ Add evaluator (`gppa-odoo`, `hackathon-odoo`) as GitHub collaborator by **31 Oct, 11:00 AM** |
| **Team** | Hanvith Sai Alla (`hanvithSai`): Product, Architecture, Frontend · Lagishetty Vamshi (`LV2402`): Backend, DB, Integration, Tests |
| **Stack** | Next.js 16.4.3 (App Router, TS) · MongoDB Atlas + Mongoose · Tailwind v4 + shadcn/ui · Vercel · GitHub Actions |
| **Live URLs** | Production: https://www.sunpowersolutions.me (apex `sunpowersolutions.me` redirects to www) · Vercel: https://sunpowersolutions.vercel.app · ✅ live and verified 31 Oct (health `db: up`) |

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
| Dispatch + serials | Serials on paper are lost by the time a warranty claim comes | Dispatch screen with **camera barcode scan or manual entry**. Each serial is checked against the SKU and stock. Dispatch is blocked until every serialized item is scanned. Dispatch also **issues the GST tax invoice** with the advance already applied | The truck can't leave with a missing serial. **Delivery starts every warranty clock** (2y inverter/battery/charge controller, 20y panels, 5y workmanship) |
| On the roof | Site registers, photos scattered on phones | Mobile-first job form: start/finish time, confirmed kW, generation test, photos, extra material used, **on-screen customer signature**. Completion writes time logs and generates a certificate listing **every installed serial and its warranty end date**; the customer gets it as a WhatsApp link | The homeowner signs on the tablet, and a moment later their phone has the certificate showing what was installed |
| Rainy-season breakdown | Can't find the customer or the serial | **Global ⌘K search** by phone, name or serial in under 1 second. Warranty status shown live, per serial, plus a **workmanship warranty** for faults with no serial (wiring, earthing, structure). The ticket can't close until the **customer confirms** the fix. Out-of-warranty work is **billed automatically**; in-warranty work costs the customer ₹0 and is **charged to that installation's profit** | Type the last 4 digits of a serial and see "In warranty, 6 months left" and a ₹0 ticket |
| Director's month-end | No P&L visibility | Dashboard for today, this week and this month: revenue, cash collected, **advances held**, stock purchased, **profit per job over its lifetime** (revenue − actual serial and bulk cost − technician hours × rate − site extras − warranty repairs), **unfinished steps per customer**, open repairs, subsidy pipeline, technician payouts. **Shareable read-only link** and CSV export | "Which jobs lost money?" is answered with one sorted table, and each loss can be traced to its cause (extra cable, overtime, warranty repair) |

### 1b. Brief coverage audit (re-checked 31 Oct, 15:10)

Every sentence of the brief was checked against this plan, `product/Requirements.md`, `product/Features.md`, `engineering/DB.md` and the code on `main` (`8be058d`). **Coverage on paper is complete. The gaps were in *how* some problems were solved**, and scenes 3 to 6 are not built yet.

| Brief asks | Plan before | Built | Gap found → fix (feature) |
|---|---|---|---|
| Enquiries from WhatsApp, calls, web; never vanish; reach sales at once | ✅ | ✅ | None. Dedupe, auto-assignment, SLA badge and no-delete are live |
| Qualify by phone (roof, bill, grid), survey (direction, tilt, cable), quote only after approval | ✅ | ✅ | Technicians land on `/my-work`, which is still a placeholder; they reach surveys only through `/surveys` → build My work first in 2.4 (F12) |
| Four packages: Panel Set, On-Grid, Off-Grid, Installation | 🟨 | 🟨 | Only the 10 On/Off-Grid systems are seeded; the hardware-only **Panel Set** (panels, connectors, wires) is missing → seed 5 panel-set packages (F07). Installation is already a service line on every system quote |
| Quote from template, parts follow on their own | ✅ | ✅ | None. 12–13 BOM lines per system incl. charge controller, earthing, lightning arrestor |
| Advance or full payment → warehouse knows, crew sees the job | ✅ | ✅ | Crew is picked by overall load, **not by who is free on the install date**, so two jobs on one day can share technicians → pick crew free that day (F09/F12, R-72) |
| Scan every serial before it leaves; which unit went to which customer | ✅ | ⬜ | Serialized stock enters only through a GRN, and none is seeded yet, so nothing can be dispatched → seed GRNs with serials + printed barcodes (3.5, moved earlier to 2.1) |
| Warranty clock starts by itself at delivery | ✅ | ⬜ | Faults with no serial (wiring, earthing, structure) were "Not applicable", which **bills a customer for our own workmanship** → 60-month workmanship warranty from commissioning (F13, R-70) |
| Simple phone form, times, size, photos, signature, clear proof | ✅ | ⬜ | Proof stayed inside the app → certificate lists installed serials + warranty ends and goes to the customer as a link (F12, F22-lite) |
| Find customer + serial in seconds; in warranty → free; else billed; ticket until customer confirms | ✅ | ⬜ | Code allows `resolved → closed` with no confirmation, contradicting BR-06 → add `customer_confirmed` status (F13). Free repairs had no cost owner → charge parts at cost + labour to the original order's profit (F14, R-71) |
| Which installations made / lost money | ✅ | ⬜ | Profit would equal the quote margin unless real costs are captured → GRN cost per serial, time logs × rate, site extras as stock moves, warranty repairs (F14) |
| What is still unfinished | 🟨 | ⬜ | "No stage change for 7 days" misses customers waiting on a step → count and list each pending step (F15) |
| Advance payments, stock purchases, technician hours scattered | 🟨 | ⬜ | Not on the dashboard → KPIs for advances held, purchases this period, hours logged (F15) |
| Invoices to send | ✅ | ⬜ | Sale invoice was planned at delivery; GST needs it at or before removal of goods → **issue at dispatch** (F14, R-73) |
| Subsidy paperwork to track | P1 | 🟨 data model only | Explicit in the brief but could be cut → **P0-lite** (F16) |
| Technicians to pay | P1 | ⬜ | Explicit in the brief but could be cut → **P0-lite** (F18) |
| Share these numbers | P1 | ⬜ | Explicit in the brief and in demo step 7 but could be cut → **P0-lite** (F17) |
| Today / this week / this month; profit per job; open repairs | ✅ | ⬜ | None |

**Doc drift to clean up in 5.2 (code is the source of truth):** ticket priorities (`low/medium/high/urgent` in code vs `low/normal/high` in Features.md), lead source `website` (not `web`), order statuses `ready_to_dispatch` and `closed` missing from Features.md F09, job status `to_schedule` in Features.md (code auto-schedules instead), and the collections list in section 5 (fixed below).

---

## 2. Consultant recommendations (how we win)

1. **Judges are from Odoo, so mirror Odoo's integrated-ERP mental model.** CRM → Sales → Inventory → Field Service → Helpdesk → Accounting, all on one record. Integration across modules beats depth in any single module, so show the **chained automations** (quote accepted → pick list + job; delivered → warranties; ticket out-of-warranty → invoice).
2. **Enforce the process; don't just record it.** Gates (no quote before survey, no dispatch before all serials are scanned) are the clearest proof that we solved *their* problem, not just built CRUD screens.
3. **Depth over breadth in the demo path.** One golden path, Enquiry → Warranty claim, must be flawless end to end. Each secondary module needs only a list, a detail page and the one action that matters.
4. **Explicit scope cuts** (to avoid the 12-hour trap): no payment gateway (record payments manually), no WhatsApp Business API (use free `wa.me` click-to-chat deep links instead), no SMS or email, no native app (a responsive PWA-style technician view instead), no multi-company setup, no full accounting ledger, no credit notes, no browser E2E suite (scripted flow checks against Atlas instead).
5. **India-ready by default:** ₹ in the lakh format (₹1,50,000), GSTIN on invoices, PM Surya Ghar subsidy tracker, DISCOM net-metering stages, Telangana seed data.
6. **Meet the event's must-haves on purpose:** dynamic DB-backed data (no static JSON), Zod validation on client and server, a responsive and consistent UI, and **commits from both members** throughout the day.
7. **Ship deployable from hour 1.** Get a skeleton onto Vercel early, with lint + typecheck + build CI. Late deploy surprises are the #1 hackathon killer.

---

## 3. Users & roles (RBAC)

| Role | Persona (seeded) | Main screens |
|---|---|---|
| **Admin / Director** | Rajesh Reddy, Founder | Dashboard, P&L, settings, users, share links |
| **Sales** | Priya Sharma | Leads pipeline, qualification, quotes, orders, payments |
| **Technician** (surveyor + installer) | Ravi Kumar (+14 more) | My work (mobile home): surveys, installations, service visits, own hours |
| **Warehouse** | Suresh Yadav | Stock, purchases (GRN), pick lists, dispatch scanning |
| **Support** | Anjali Rao | ⌘K search, tickets, warranty lookup |
| **Customer** (public, no login) | Homeowner | Enquiry form, warranty lookup by serial/phone, project status link (nice-to-have) |

---

## 4. Feature backlog (MoSCoW, prioritised)

**P0 = Must (demo path) · P1 = Should · P2 = Could (only if ahead of schedule)** · Change on 31 Oct 15:10: **▲** promoted · **✚** enhanced after the brief audit (section 1b) · **▼** demoted · **✂️** cut

"Lite" means the smallest version that answers the brief's sentence; the rest of the spec in `product/Features.md` stays at its old priority.

| ID | Module | Feature | Pri | Change | Owner (BE / FE) |
|---|---|---|---|---|---|
| F01 | Platform | Auth (email+password, JWT cookie, `proxy.ts` route guard), RBAC by role | P0 | | Vamshi / Hanvith (login UI) |
| F02 | Platform | App shell: sidebar, top bar, ⌘K search, role-aware nav, toasts, empty/loading/error states | P0 | | — / Hanvith |
| F03 | Leads | Public enquiry form → Lead (source, kW need, subsidy interest), validation, rate limit | P0 | | Vamshi / Hanvith |
| F04 | Leads | Pipeline (kanban + table), manual lead entry with source tag, SLA "uncontacted" badge, activity timeline, `wa.me`/`tel:` actions | P0 | | Vamshi / Hanvith |
| F05 | Leads | Qualification checklist (roof area, bill, grid, shadow) → qualify / reject with reason | P0 | | Vamshi / Hanvith |
| F06 | Survey | Assign survey to technician; mobile survey form (direction, tilt, cable distance, shading, photos); approve/reject | P0 | | Vamshi / Hanvith |
| F07 | Catalog | Products (serialized vs bulk, cost, price, warranty months, HSN, GST %), package templates with BOM. **All four package kinds from the brief:** On-Grid and Off-Grid 1–5 kW, **Panel Set 1–5 kW** (panels, MC4 connectors, DC cable; no subsidy) and Installation as a service line. Catalog editing UI stays P2 | P0 | ✚ | Vamshi / Hanvith |
| F08 | Quote | Quote from template → auto BOM, editable lines, subsidy + GST calc, versioning, print/PDF view; **gate: survey approved** | P0 | | Vamshi / Hanvith |
| F09 | Order | Accept quote → Order; record payments (advance/full, mode: UPI/NEFT/Cash/Cheque); auto pick list + installation job. **Auto-crew picks installers free on the install date** (next free day if not enough), never by overall load alone | P0 | ✚ | Vamshi / Hanvith |
| F10 | Inventory | Stock levels per product, serial register (in-stock / allocated / dispatched / installed / replaced / RMA), purchase receipt (GRN) with serial entry and **unit cost per serial**, low-stock alerts, stock value at cost | P0 | ✚ | Vamshi / Hanvith |
| F11 | Dispatch | Pick list → scan serials (camera barcode + manual), validation, **block until complete**. **Dispatch issues the sale GST invoice** (advance applied). Mark delivered → **auto warranty start** for every serial | P0 | ✚ | Vamshi / Hanvith |
| F12 | Installation | **My work** (technician home: today's surveys, jobs, service visits) built first. Crew calendar, reassign with double-booking warning; mobile job form: start/finish, confirmed kW, generation test, kit check, photos, **extra material used** (posted as stock moves on the order), **signature pad**. Completion writes a time log per crew member and a **certificate listing installed serials and warranty end dates** | P0 | ✚ | Vamshi / Hanvith |
| F13 | Service | ⌘K search (phone/name/serial/project no.), warranty card **per serial**, **workmanship warranty (60 months from commissioning) for faults with no serial**, ticket lifecycle Open → Assigned → In Progress → Resolved → **Customer Confirmed** → Closed (new status in code; "Not fixed" reopens), in-warranty = ₹0, out-of-warranty → auto invoice for parts + labour, billability override with reason, serial replacement (BR-15) | P0 | ✚ | Vamshi / Hanvith |
| F14 | Finance | Invoices (GST, GSTIN, ₹ format), payment status. **Job costing from actuals:** serial cost from its GRN, bulk at catalog cost, time logs × each technician's rate (survey + install + service), site extras, **in-warranty repair cost (parts at cost + labour) charged to the original order** | P0 | ✚ | Vamshi / Hanvith |
| F15 | Dashboard | Today/week/month KPIs (revenue, cash collected, **advances held** on unfinished orders, **stock purchased**, hours logged, margin, open tickets), profit-per-job table (sortable, losers red, cost breakdown on hover/click), **unfinished steps board** (uncontacted leads, surveys to review, quotes awaiting reply, paid but not dispatched, delivered not installed, balance due after commissioning, subsidy not disbursed, tickets awaiting customer confirmation), open repairs by age, revenue trend | P0 | ✚ | Vamshi / Hanvith |
| F16 | Subsidy | **Lite (P0):** stage stepper on the order (Not applied → Applied → Feasibility → Net meter → Inspected → Disbursed) with dates and application number; counts and ₹ by stage on the dashboard; `/subsidy` board. **Full (P1):** document uploads (GridFS), warnings when installing before feasibility | P0-lite | ▲ | Vamshi / Hanvith |
| F17 | Dashboard | **Lite (P0):** create a read-only dashboard link that expires (7 days default), `/share/[token]` view with customer contact details masked, profit-per-job CSV. **Full (P1):** revoke UI, view count, invoice and ticket CSVs | P0-lite | ▲ | Vamshi / Hanvith |
| F18 | Payroll-lite | **Lite (P0):** `/team` monthly hours × rate per technician from time logs, payout total, CSV. **Full (P1):** edit/correct logs, close month, overlap checks | P0-lite | ▲ | Vamshi / Hanvith |
| F19 | Platform | Audit log / activity timeline on every record | P1 | | Vamshi / Hanvith |
| F20 | Public | Customer warranty lookup page (serial or phone + OTP-less last-4 check) | P1 | | Vamshi / Hanvith |
| F21 | Notifications | Email via Resend free tier. Cut: no verified sender domain, and `wa.me` links plus in-app automation already remove the phone calls | — | ✂️ | — |
| F22 | Public | **Lite (P1):** certificate link sent by `wa.me` on job completion (reuses F17 share tokens, scope `certificate`). Full project tracking link stays P2 | P1 / P2 | ✚ | Vamshi / Hanvith |
| F23 | Technician | Offline-tolerant job form. Reduced to a local draft (autosave the job form to `localStorage`, restore on reload); queued sync is cut | P2 | ▼ | — / Hanvith |

---

## 5. Architecture (summary, full detail in `engineering/Architecture.md`)

A walkthrough of the code itself (modules, files, key functions, who built what) is in `engineering/Codebase.md`.

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
- **Automations as service-level side effects inside Mongo transactions**: order confirmed → pick list + job (crew free that day); dispatched → sale invoice; delivered → warranties; job completed → serials installed + time logs + certificate; ticket resolved in warranty → cost charged to the order; ticket resolved out of warranty → service invoice.
- **Money stored as integer paise** to avoid float rounding errors in ₹ totals.
- **Auth:** ✅ decided: **Auth.js v5**, using the Credentials provider and JWT sessions that carry the role. Passwords are bcrypt hashes in `users`. It's a maintained, widely used library with Next 16 support, so we don't hand-roll security.
- **Photos & videos in GridFS:** ✅ decided. No extra vendor account. Images are compressed in the browser, and large files go up in ~4 MB pieces, staying under Vercel's 4.5 MB request limit and Atlas M0's 512 MB.
- **Open-source / free only:** Radix + shadcn-style UI, lucide-react, Recharts, Zod, `@zxing/browser` (barcode), `signature_pad`, Vitest, GitHub Actions, Vercel Hobby, **PostHog free tier** (✅ decided: analytics + error tracking).

### Core collections (full schemas in `engineering/DB.md`)
`users` · `customers` · `leads` · `surveys` · `products` · `packages` (BOM templates) · `quotes` · `orders` (embeds pick list, dispatch, subsidy tracker, site extras) · `payments` · `stockmoves` · `serialunits` (embed warranty start/end) · `purchases` (GRNs) · `jobs` (embed time logs, signature) · `tickets` · `invoices` · `sharelinks` · `activities` · `counters` (human-readable numbers such as `SP-Q-0142`, `INV/26-27/0001`) · GridFS `media` + `media_uploads`. There are no separate `pickLists`, `warranties`, `timeLogs` or `subsidyApplications` collections; see `engineering/DB.md`.

---

## 6. Seed data (real DB, India-specific, every feature demo-able)

Run with `npm run seed` (idempotent; wipes and reseeds). It covers **about 14 months of history**, plus backdated legacy projects so both warranty outcomes exist.

**Must-haves for the demo (added 31 Oct 15:10):**
- **GRNs with serials** for every serialized product. Serialized stock enters only through a GRN, so without these nothing can be dispatched. Each GRN carries a unit cost that differs slightly between batches, so costing visibly uses actual cost. Print barcodes for about 10 of these serials (Requirements Q20).
- **The brief's own scene:** a 3 kW On-Grid project delivered **18 months ago** (inverter still in warranty, about 6 months left) and one delivered **about 28 months ago** (inverter out of warranty, panels still covered).
- **A wiring/earthing ticket with no serial** on a 2-year-old project, which the workmanship warranty covers (₹0).
- **Five Panel Set packages** (1–5 kW).
- **Loss-makers with a visible cause:** one with 40 m of extra cable, one with overtime hours, one with an in-warranty inverter replacement charged to it.
- **Unfinished steps:** at least one customer at every pending step on the dashboard board, a ticket in `customer_confirmed`, and subsidy records at every stage.

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

## 8. Timeline, owners & ETA

Phases 0–1 used times relative to kickoff (T+0 = 31 Oct 10:00). **From Phase 2 on, times are IST clock times** (re-baselined 31 Oct 15:10; Phase 1 finished at T+4:11, on time). Each phase ends with a merge to `main`, a Vercel deploy, a `/api/v1/health` check and a Plan.md update.

### Phase 0: Foundation (T+0:00 → T+1:30)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 0.1 | Docs: `product/*` (6), `engineering/*` (4), `Setup.md`, `Human_Tasks.md`, `Agent_Content.md`, `README.md` | Hanvith (DB/API docs: Vamshi) | `docs/product-plan`, `docs/engineering` | ✅ |
| 0.2 | Design system: Apple-style tokens, Inter, UI kit (Radix), app shell + sidebar + ⌘K palette, login with demo accounts, module placeholders | Hanvith | `feat/ui-shell` | ✅ |
| 0.3 | Domain lib (enums, state machines, money, GST, subsidy, warranty, IST dates, validation), Mongo connection + transactions, all 18 models, counters, audit log, invoicing, stock ledger | Vamshi | `feat/domain-lib`, `feat/db-core` | ✅ |
| 0.4 | Auth.js v5 (Credentials + JWT roles), `proxy.ts` guard, role-based nav, `/api/v1/health`, staff seed (20 accounts in Atlas) | Vamshi | `feat/auth`, `feat/seed-users` | ✅ verified on Atlas: sign-in, role landing pages, role redirects, 404 |
| 0.5 | CI (lint, typecheck, test, build) on every PR + push to main; Vercel deploy | Vamshi | `chore/ci`, `chore/deployment-config` | ✅ CI green on every push · ✅ Vercel builds `main` (production verified on `681cea0`) |
| 0.6 | 👤 Human: evaluator collaborators, Atlas URI, Vercel link, domain | Hanvith / Vamshi | — | ✅ all done |

### Phase 1: Sales core (T+1:30 → T+4:00), golden path part 1
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 1.1 | Schemas + services: lead, customer, qualification, survey (state machine) | Vamshi | `feat/leads-api` | ✅ (flow check: scripts/check-lead-flow.ts) |
| 1.2 | Public enquiry form, pipeline kanban/table, lead detail + timeline, qualification UI, survey mobile form + review | Hanvith | `feat/leads-ui` | ✅ |
| 1.3 | Schemas + services: products, packages/BOM, quote (calc engine: subsidy, GST, paise), order, payments + automations | Vamshi | `feat/catalog-quotes-api` | ✅ (flow check: scripts/check-sale-flow.ts, 15/15) |
| 1.4 | Survey mobile form, quote builder (template → BOM), printable quote, order + payment UI, catalog | Hanvith | `feat/leads-ui`, `feat/quotes-ui` | ✅ |
| 1.5 | Seed v1: users, catalog (30 products, 10 packages, opening stock) — leads/orders at all stages come with the full seed (3.5) | Vamshi | `feat/catalog-quotes-api` | ✅ users + catalog · ⬜ pipeline data |

### Phase 2: Operations (15:30 → 19:30), golden path part 2
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 2.1 | Inventory: stock moves, serial units, GRN with unit cost per serial, allocation, dispatch validation (BR-02), **sale invoice at dispatch**, delivery → warranty automation (BR-03). **Seed GRNs with serials now** (moved up from 3.5) so dispatch can be tested | Vamshi | `feat/inventory-api` | ✅ (flow check: scripts/check-ops-flow.ts, 30/30; 4 GRNs, 181 serials seeded) |
| 2.2 | Stock (with value at cost), GRN and serial register screens; dispatch scanner (camera + manual) | Hanvith | `feat/dispatch-ui` | ✅ stock, serial register, GRN form (camera + paste), dispatch queue, packing bench |
| 2.3 | Jobs: **crew picked from technicians free on the date** (fix `pickCrew`), reschedule/reassign with double-booking warning, start gate (delivered), completion (BR-14) + signature + photos, **extra material as stock moves**, time log per crew member, certificate data (installed serials + warranty ends) | Vamshi | `feat/jobs-api` | ✅ (ops flow check now 46/46: crews never double-booked, start gate, BR-14 proof, time logs, extras to costing) |
| 2.4 | **My work first** (replaces the placeholder technician home: today's surveys, jobs, visits), then crew calendar, installation form, signature pad, certificate print view | Hanvith | `feat/jobs-ui` | ✅ My work, crew calendar (next 7 days, clash highlights), job page with Start gate + completion form (photos, signature, extras), reschedule, printable certificate with serial + workmanship warranties |

### Phase 3: Service, finance, insight (19:30 → 00:30)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 3.1 | Global search (phone with +91/spaces normalised, last-4 of serial or phone, names, document numbers), ticket state machine **with `customer_confirmed`** (close only from it; "Not fixed" reopens), warranty per serial + **workmanship warranty for no-serial faults**, billability override with reason, out-of-warranty auto invoice, **in-warranty cost charged to the order**, serial replacement (BR-15) | Vamshi | `feat/service-api` | ⬜ |
| 3.2 | ⌘K record search, ticket list/detail, warranty card, confirmation dialog (who, channel, when) | Hanvith | `feat/service-ui` | ⬜ |
| 3.3 | Invoices, **costing from actuals** (GRN cost, time logs × rate, extras, warranty repairs), dashboard aggregations (today/week/month, advances held, purchases, hours, **unfinished steps**), subsidy stage action, share links (create + expiry) + profit CSV, payroll summary + CSV | Vamshi | `feat/finance-api` | ⬜ |
| 3.4 | Director dashboard (KPIs, revenue trend, P&L table with cost breakdown, unfinished-steps board, open repairs), invoices, subsidy board + order stepper, `/share/[token]` view, `/team` payouts | Hanvith | `feat/dashboard-ui` | ⬜ |
| 3.5 | Seed v2 (22:30 → 01:30): full history plus the section 6 must-haves (18-month and 28-month projects, no-serial ticket, panel sets, loss-makers with causes, every pending step) | Vamshi | `feat/seed` | ⬜ |

### Phase 3b: Brief-complete extras (00:30 → 02:30, only after the golden path passes on production)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 3.6 | Certificate link by `wa.me` on job completion (F22-lite, reuses share tokens) | Vamshi / Hanvith | `feat/certificate-link` | ⬜ |
| 3.7 | Public warranty lookup (F20) | Vamshi / Hanvith | `feat/warranty-lookup` | ⬜ |
| 3.8 | Subsidy documents upload, share-link revoke, invoice/ticket CSVs (F16/F17 full) | Vamshi / Hanvith | `feat/finance-extras` | ⬜ |

### Phase 4: Hardening (02:30 → 04:00)
| # | Task | Owner | Branch | Status |
|---|---|---|---|---|
| 4.1 | Unit tests (Vitest): quote calc, state machines (incl. `customer_confirmed`), warranty dates + workmanship, costing (incl. warranty repair), crew availability. 6 tests already in CI | Vamshi | `test/core` | ⬜ |
| 4.2 | Flow checks instead of Playwright: extend `scripts/check-*-flow.ts` with `check-ops-flow.ts` (GRN → dispatch → invoice → delivery → warranties → job complete) and `check-service-flow.ts` (in/out of warranty, no-serial, confirmation gate), run against Atlas. Playwright E2E ✂️ | Vamshi | `test/flows` | ⬜ |
| 4.3 | PostHog: only if the key arrives (Requirements Q4); server events already flow through `trackServer`. Otherwise ✂️ | Hanvith | `feat/analytics` | ⬜ |
| 4.4 | UX polish: 360 px pass on technician screens, empty states, a11y, loading skeletons; F23 local draft if time allows | Hanvith | `feat/ui-polish` | ⬜ |

**04:00 → 07:00: buffer.** Overruns land here; if nothing overran, rest.

### Phase 5: Demo readiness (07:00 → 10:30)
| # | Task | Owner | Status |
|---|---|---|---|
| 5.1 | 07:00 → 08:00 bug bash on the production URL (both devs swap roles; run every demo step on a phone) | Both | ⬜ |
| 5.2 | 08:00 → 08:30 final docs pass (README, Setup, API, DB, Architecture, the doc drift in 1b), Plan.md frozen. **08:30 code freeze**: only demo-blocking fixes until 10:00 | Both | ⬜ |
| 5.3 | 08:30 → 10:15 record the demo video on the frozen build; submit the link by **10:30** | Hanvith | ⬜ |

**Buffer rule:** if a phase overruns by more than 30 minutes, cut in this order: F23 → 4.3 → 3.8 → 3.7 → 3.6 → the CSV parts of F17/F18. The P0 golden path and the three brief-explicit lites (subsidy stage, share link, payout summary) are never cut.

---

## 9. Demo script (5 minutes, golden path)

1. A customer submits an enquiry on a phone; it **appears in the pipeline** (Sales).
2. Sales qualifies the lead and assigns a survey. The technician fills in the survey on mobile and Sales approves it, which **unlocks the quote**.
3. Sales builds a quote from "3 kW On-Grid": the **BOM auto-fills** and the subsidy and GST are calculated. Sales records the advance, which **creates the pick list and the job**.
4. The warehouse scans serials (missing ones are blocked) and dispatches, which **issues the GST invoice**. Marking the order delivered **starts the warranties**.
5. The technician opens **My work** on a phone and completes the job: times, photos, the extra cable used, **customer signature**. The certificate lists every installed serial.
6. "Eighteen months later": support types the last 4 digits of the inverter serial in ⌘K, sees "In warranty, 6 months left" and raises a ₹0 ticket. Resolving it doesn't close it; it waits for the **customer's confirmation**. Then show the 28-month-old project, where the inverter is out of warranty and the **invoice is generated automatically**.
7. The director opens the dashboard: **profit per job** with losers highlighted and their causes, unfinished steps per customer, advances held, open repairs, subsidy stages and technician payouts, then **shares a read-only link**.

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
| Production misconfiguration (env vars) | After every deploy check `/api/v1/health` (`db` and `version`); env-var checklist in Setup.md §8 (no quotes or placeholders, redeploy after edits). See the incident in engineering/Engineering.md |
| Latency: functions far from users and Atlas | ✅ Functions pinned to Mumbai (`bom1`) in `vercel.json`; health reports `region` |
| Added scope pushes the golden path past midnight | Promoted items are "lite" and sit inside tasks that were planned anyway; Phase 3b starts only after the golden path passes on production; cut order in section 8 |
| Overnight fatigue causes late regressions | 04:00–07:00 buffer, 08:30 freeze, flow checks (4.2) run before every merge to `main` after 00:30 |
| Dispatch demo has no serialized stock | GRN seed moved into 2.1; printed barcodes for ~10 serials (Requirements Q20) |

---

## 11. Decisions (resolved 31 Oct)

1. **Auth:** Auth.js v5 (Credentials + JWT).
2. **Photo & video storage:** MongoDB GridFS with chunked uploads.
3. **Analytics:** PostHog Cloud free tier.
4. **Domain:** Namecheap. The domain name is still to be shared (Human_Tasks #7).
5. **Window:** coding wraps up well before the 01 Nov 10:00 AM cut-off. Commits land after every logical unit under the owning developer and are pushed in small batches.
6. **Vercel function region:** ✅ Mumbai (`bom1`), pinned in `vercel.json` (approved 31 Oct).
7. **Health diagnostics:** ✅ `/api/v1/health` reports a safe failure `reason` plus `version` and `region` (approved 31 Oct).
8. **Scope after the brief audit (31 Oct 15:10, section 1b):** F16, F17, F18 promoted to P0-lite; F21 cut; F22 split (certificate link P1); F23 reduced to a local draft; Playwright replaced by flow checks.
9. **Sale invoice timing:** issued automatically **at dispatch**, not at delivery. Under GST a goods invoice is due at or before removal of goods, and dispatch also satisfies the services reading. CA confirmation is still pending (Requirements Q10).
10. **Ticket closure:** new `customer_confirmed` status between `resolved` and `closed`, recording who confirmed, the channel and the time (BR-06). `resolved → closed` is removed from `TICKET_FLOW`.
11. **Workmanship warranty:** faults with no serial (wiring, earthing, structure, leaks) are covered for 60 months from commissioning, taken from the installation service's `warrantyMonths` (BR-04).
12. **Warranty repair cost:** parts at cost plus labour on in-warranty tickets are charged to the original order, so profit per job is lifetime profit.
13. **Auto-crew:** pick installers with no job on the install date (least loaded first); if fewer than 3 are free, move to the next day that has 3.

---

## 12. Progress log

| Time | Who | Update |
|---|---|---|
| 31 Oct, 10:30 | Hanvith | Plan drafted and reviewed. Decisions: Auth.js v5, GridFS media, PostHog, Namecheap |
| 31 Oct, 11:00 | Hanvith | Evaluators added as GitHub collaborators |
| 31 Oct, 11:30 | Vamshi | Domain lib, 18 Mongo models, core services, Auth.js + proxy, health check |
| 31 Oct, 12:10 | Hanvith | Product docs (PRD, features, personas, analytics, style guide, requirements), engineering docs, Setup guide, design system, app shell, login |
| 31 Oct, 12:20 | Vamshi | Atlas connected; 20 staff accounts seeded; sign-in and role routing verified. Slow venue network handled (standard Atlas string locally, 30 s timeout, IPv4) |
| 31 Oct, 12:24 | Both | **Phase 0 pushed:** lint, typecheck, build green; WCAG contrast fixes; self-hosted Inter |
| 31 Oct, 12:41 | Both | Live URLs recorded; `vercel.json` framework pin; switched to per-unit commits under each developer |
| 31 Oct, 12:50 | Both | Media pipeline (GridFS uploads, signature pad, barcode scanner) verified 11/11 on Atlas and merged |
| 31 Oct, 13:53 | Both | **Phase 1a:** enquiries (web form + API, dedupe, auto-assign), pipeline board/table with SLA, qualification, survey booking, mobile survey form with photos, review gate → quote unlocked. Flow check 10/10 |
| 31 Oct, 14:11 | Both | **Phase 1b:** catalog seed, quote builder (package → full BOM, live GST/subsidy/margin), quote detail/print/WhatsApp, accept → order, payments (first payment confirms → pick list + installation job). Flow check 15/15 |
| 31 Oct, 14:30 | Both | **Incident:** production sign-in failed (“We couldn't sign you in right now”). Root cause: the `MONGODB_URI` set in Vercel had credentials Atlas rejected; consistent ~2 s failures ruled out a missing variable (instant) and an IP block (30 s). Fixed by updating the variable and redeploying; health `db: up` on `681cea0` |
| 31 Oct, 14:45 | Both | Documentation synced with Phase 1, the live deployment and the incident |
| 31 Oct, 15:00 | Both | Functions moved to Mumbai (`bom1`); health check now reports failure `reason`, `version` and `region`; first unit tests (Vitest, 6) in CI |
| 31 Oct, 15:10 | Hanvith | **Brief re-audit** (section 1b): coverage complete on paper; 13 fixes to *how* problems are solved (workmanship warranty, customer-confirmed status, invoice at dispatch, crew availability, real costing, warranty cost to order, unfinished-steps board, advances/purchases KPIs, panel-set packages, My work first, GRN seed earlier, certificate to customer). F16–F18 → P0-lite; F21 cut; Playwright → flow checks; timeline re-baselined to clock times |
| 31 Oct, 16:55 | Both | **Phase 2 complete** (inventory, dispatch, installation), merged and pushed with commits from both developers. Ops flow check 46/46 and 22 unit tests on local MongoDB; production build green. GRNs (4 receipts, 181 serials) seed through the real service. Atlas needs `npm run seed -- --yes` for the GRNs before the dispatch demo |
| 31 Oct, 17:40 | Hanvith | Code walkthrough added: `engineering/Codebase.md` (one order end to end, modules, files, key functions, who built what) at `b799ac3`; README status synced with Phase 2 |
| Next | Both | Phase 3: service desk (⌘K search, tickets with `customer_confirmed`, workmanship warranty, out-of-warranty invoice), finance (costing from actuals, dashboard, subsidy, share link, payroll) and the full seed |
