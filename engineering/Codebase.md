# Codebase.md: The code from the top down

| | |
|---|---|
| **Snapshot** | `main` at `b799ac3`, 31 Oct 2026 (end of Phase 2) |
| **Owner** | Hanvith Sai Alla |
| **Related** | [Architecture.md](Architecture.md) · [Engineering.md](Engineering.md) · [API.md](API.md) · [DB.md](DB.md) · [Plan.md](../Plan.md) |

Read this in four passes: the big picture, the modules, the files, then the functions that carry the business rules. Section 5 shows who built what, taken from `git blame` and the branch history.

**Size:** 228 code files, about 22,600 lines (not counting docs and `package-lock.json`).

**Keeping it current:** when a module ships, add its files and functions here in the same pull request and refresh the numbers in section 5.

## 1. The big picture

SunPower OS is one Next.js 16 application. The screens and the backend live in one repository and deploy together to Vercel, with functions in Mumbai (`bom1`). All data, including photos and videos, is in one MongoDB Atlas database, also in Mumbai.

```
 Browser: director · sales · technician (phone) · warehouse · support · homeowner
    │
    ▼
 proxy.ts ── staff page while signed out? → /login        (checks the cookie only, no DB)
    │
    ├── Pages           src/app/**/page.tsx      read data, render on the server
    ├── Server Actions  src/server/actions/*     every form and button that changes data
    └── REST API        src/app/api/v1/*         public enquiries, file upload/stream, health
                   │
                   ▼
    Services  src/server/services/*   ← all business rules live here
                   │
    Models    src/server/models/*     18 Mongoose schemas
                   │
                   ▼
    MongoDB Atlas: 18 collections + GridFS "media" bucket (photos, videos)

 src/lib/*  used by BOTH browser and server: statuses, state machines,
            money, GST, subsidy, quote maths, validation, formatting
```

### Rules that hold it together

1. **Layers.** Pages and components never query the database; they call services. Actions and API routes are thin: check the role, validate the input, call one service, refresh the affected pages, record an analytics event.
2. **State machines.** Every status change (lead, survey, quote, order, job, ticket, subsidy) is checked against the allowed moves in [workflows.ts](../src/lib/workflows.ts), so a rule like "no quote before an approved survey" lives in one place.
3. **Transactions.** A change that touches several records runs as one MongoDB transaction: all of it happens or none of it does.
4. **Money in paise.** Amounts are stored as whole paise (₹1 = 100 paise), so totals never drift. GST is calculated per line and split into CGST and SGST.
5. **Audit trail.** Every change writes an Activity record. These records are the timelines on each page.
6. **One validation contract.** The same Zod schemas check input in the browser and again on the server.
7. **Readable numbers.** SP-L-0042 (lead), SP-SV, SP-Q, SP-O, SP-PAY, SP-J, SP-GRN and INV/26-27/0001 come from atomic counters, so two people never get the same number.
8. **Gates the server enforces:**
   - No quote before an approved survey.
   - No dispatch until every serial is scanned and every bulk line is ticked.
   - No installation start before delivery.
   - No completion without photos and the customer's signature.
9. **Fast pages.** A static frame appears instantly and the data streams in. Every staff route has a loading skeleton.

### One order, end to end

| Step | Who | What the code does | Main functions |
|---|---|---|---|
| 1. Enquiry | Homeowner | Finds or creates the customer by phone. A repeat enquiry within 30 days joins the open lead. A new lead goes to the salesperson with the fewest open leads | `submitEnquiryAction` → `createLead` |
| 2. Qualify, book survey | Sales | Records roof area, shadow-free area, monthly bill and grid suitability; books a technician | `qualifyLead`, `scheduleSurvey` |
| 3. Site survey | Technician, sales | The technician saves direction, tilt, shading, cable distance and photos. Sales approval unlocks quoting | `submitSurvey`, `reviewSurvey` |
| 4. Quote | Sales | A package expands into the full parts list. The server re-prices every line and adds GST and the subsidy | `saveQuote`, `quoteTotals` |
| 5. Customer accepts | Sales | Creates the order (awaiting payment) and its subsidy tracker; the lead is won | `acceptQuote` |
| 6. First payment | Sales | Confirms the order, builds the warehouse pick list, and books three installers who are free on a day about four days out | `recordPayment`, `pickCrew` |
| 7. Goods receipt | Warehouse | Registers every serial number with its own purchase cost and adds the stock to the ledger | `receiveGoods` |
| 8. Packing | Warehouse | Each scan allocates one unit to the order; bulk lines are ticked; the order becomes Packed by itself | `scanSerial`, `setBulkPicked` |
| 9. Dispatch | Warehouse | Re-checks the pick list, moves the stock out and issues the GST tax invoice with payments so far applied | `dispatchOrder`, `issueInvoice` |
| 10. Delivery | Warehouse | Starts every serial's warranty from the delivery date (panels 20 years, inverter 2 years) | `deliverOrder` |
| 11. Installation | Crew | Start is allowed only after delivery. Completion needs times, size, generation test, photos and the signature. Serials become Installed, the order Commissioned, and hours are logged per technician | `startJob`, `completeJob` |
| 12. Certificate | Staff | Prints every serial with its warranty end date, the workmanship warranty, the crew, photos and the signature | `/jobs/[id]/certificate` |

## 2. Modules

| # | Module | What it does | Built by | Status |
|---|---|---|---|---|
| 1 | Platform core | DB connection, typed errors, action and API wrappers, health check, analytics | Vamshi | ✅ |
| 2 | Auth and roles | Login, 12-hour sessions carrying the role, route guard, role-based menus and home pages | Vamshi (backend), Hanvith (login screen, menus) | ✅ |
| 3 | Domain library | Statuses, state machines, money, GST, subsidy, quote maths, warranty, IST dates, validation | Vamshi (rules), Hanvith (formatting, navigation) | ✅ |
| 4 | Leads | Enquiries from every channel, duplicate merge, auto-assignment, 2-hour first-call deadline, qualification, survey booking | Vamshi (logic), Hanvith (screens) | ✅ |
| 5 | Site surveys | Technician's on-roof form with photos; sales approves, asks for a re-survey or closes the lead | Both | ✅ |
| 6 | Catalog and quotes | 30 products and 10 packages; the builder fills in the full parts list; GST, subsidy, margin; print view | Both | ✅ |
| 7 | Orders and payments | An accepted quote becomes an order; the first payment confirms it, builds the pick list and books the crew | Both | ✅ |
| 8 | Inventory | Stock with reserved and available quantities and value at cost; serial register; goods receipts | Both | ✅ Phase 2 |
| 9 | Dispatch | Packing bench with camera scanning, dispatch gate, tax invoice at dispatch, delivery starts the warranties | Both | ✅ Phase 2 |
| 10 | Installations | Crew calendar with clash highlights, the technician's "My work", start gate, completion proof, certificate | Both | ✅ Phase 2 |
| 11 | Media | Photos and videos in GridFS: compressed in the browser, large files uploaded in pieces, streamed with seeking | Both | ✅ |
| 12 | Public website | Landing page, enquiry form, enquiry API, rate limit, spam trap | Both | ✅ |
| 13 | App shell and design system | Layouts, sidebar, mobile menu, ⌘K palette, Apple-style tokens, 19 UI primitives, 21 shared components | Hanvith | ✅ ⌘K record search waits for the Phase 3 search API |
| 14 | Data, quality and delivery | Seed, flow checks, offline database, unit tests, CI, Vercel config | Vamshi | ✅ |
| 15 | Not built yet (Phase 3) | Service tickets, customers page, invoices screen, subsidy board, director dashboard, team and payroll, share links, search API. The Ticket and ShareLink models exist, and their menu items open a "coming soon" card | — | ⬜ |

## 3. Files

### Project config

| File | Purpose | By |
|---|---|---|
| [package.json](../package.json) | Dependencies; scripts `dev`, `build`, `lint`, `typecheck`, `seed`, `db:local`, `test` | Hanvith |
| [next.config.ts](../next.config.ts) | Cache Components, partial prefetching, Tailwind loader, PostHog proxy at `/ingest` | Hanvith |
| [tsconfig.json](../tsconfig.json), [eslint.config.mjs](../eslint.config.mjs), [.gitignore](../.gitignore), [.env.example](../.env.example) | TypeScript settings, lint rules, ignored files, environment template | Hanvith |
| [vercel.json](../vercel.json) | Pins the functions to Mumbai | Vamshi |
| [vitest.config.mts](../vitest.config.mts) | Unit-test runner | Vamshi |
| [ci.yml](../.github/workflows/ci.yml) | Lint → typecheck → test → build on every pull request and push to `main` | Vamshi |
| [CODEOWNERS](../.github/CODEOWNERS) | Requests the right reviewer automatically (Hanvith: UI; Vamshi: server, API, scripts) | Vamshi |

### `src/server`: backend (all Vamshi)

**Models** (11 files, 18 models)

| File | Models | Key points |
|---|---|---|
| [user.ts](../src/server/models/user.ts) | User | Password hash hidden by default; role, skills, hourly rate |
| [crm.ts](../src/server/models/crm.ts) | Customer, Lead, Survey | One customer per phone number; the lead holds the requirement and qualification; the survey holds measurements and photo ids |
| [catalog.ts](../src/server/models/catalog.ts) | Product, Package | SKU, cost, price, GST %, HSN, warranty months, stock; a package is a parts-list template |
| [sales.ts](../src/server/models/sales.ts) | Quote, Order, Payment | Lines are price snapshots; the order holds the pick list, dispatch details, subsidy tracker and extra costs |
| [inventory.ts](../src/server/models/inventory.ts) | SerialUnit, StockMove, Purchase | One record per serial number with its cost, history and warranty dates; append-only stock ledger; goods receipts |
| [operations.ts](../src/server/models/operations.ts) | Job | Crew, start and finish, checklist, kit check, extra material, photos, signature, time logs |
| [service.ts](../src/server/models/service.ts) | Ticket | Warranty state captured at creation; resolution (Phase 3) |
| [finance.ts](../src/server/models/finance.ts) | Invoice, ShareLink | CGST/SGST/IGST totals; expiring read-only links (Phase 3) |
| [system.ts](../src/server/models/system.ts) | Counter, Activity | Document numbers; audit log |
| [shared.ts](../src/server/models/shared.ts), [index.ts](../src/server/models/index.ts) | — | Reusable address and line-item parts; single import point |

**Services** (the business rules)

| File | Responsibility |
|---|---|
| [leads.ts](../src/server/services/leads.ts) | Lists, board, headline stats, detail; create, contact, qualify, lose, reopen, assign, book survey |
| [surveys.ts](../src/server/services/surveys.ts) | Lists and detail; the technician's submission; the sales review |
| [quotes.ts](../src/server/services/quotes.ts) | Survey gate, builder data, save, list, detail, send, decline, accept → order |
| [orders.ts](../src/server/services/orders.ts) | List, detail, cancel |
| [payments.ts](../src/server/services/payments.ts) | Record a payment (the first one confirms the order); list payments |
| [inventory.ts](../src/server/services/inventory.ts) | Stock levels and value, serial register, goods receipts |
| [dispatch.ts](../src/server/services/dispatch.ts) | Packing (scan, un-scan, tick), dispatch, delivery |
| [jobs.ts](../src/server/services/jobs.ts) | Crew calendar, "My work", job detail, reschedule, start, complete |
| [customers.ts](../src/server/services/customers.ts) | Find or create a customer by phone; electricity distributor (DISCOM) by city |
| [catalog.ts](../src/server/services/catalog.ts) | Active catalog, priced packages, products with stock and margin |
| [users.ts](../src/server/services/users.ts) | Staff list for pickers |
| [core/crew.ts](../src/server/services/core/crew.ts) | Books three installers who are free on the day |
| [core/activity.ts](../src/server/services/core/activity.ts) | Writes and reads timelines |
| [core/counters.ts](../src/server/services/core/counters.ts) | SP-… and INV/26-27/… numbers |
| [core/stock.ts](../src/server/services/core/stock.ts) | The only way stock changes |
| [core/invoicing.ts](../src/server/services/core/invoicing.ts) | Issues a GST tax invoice |
| [core/files.ts](../src/server/services/core/files.ts) | Media storage: validate, store, upload in pieces, stream, delete |

**Also in `src/server`:**

- **Actions** ([src/server/actions/](../src/server/actions/)): auth, leads, surveys, quotes, orders, inventory, jobs, public. These are the entry points the UI calls for every change.
- **Auth:** [auth.config.ts](../src/server/auth/auth.config.ts) (rules light enough to run on every request), [config.ts](../src/server/auth/config.ts) (password check against the database), [session.ts](../src/server/auth/session.ts) (`requireUser`), plus [proxy.ts](../src/proxy.ts) and [next-auth.d.ts](../src/types/next-auth.d.ts).
- **Helpers** ([src/server/lib/](../src/server/lib/)): action.ts, api.ts, validate.ts, actor.ts, rate-limit.ts, db-errors.ts. Plus [db.ts](../src/server/db.ts), [errors.ts](../src/server/errors.ts) and [analytics.ts](../src/server/analytics.ts).

### `src/app/api`: REST endpoints (all Vamshi)

| Route | Purpose |
|---|---|
| `/api/auth/*` | Auth.js sign-in and session endpoints |
| `POST /api/v1/enquiries` | Public enquiry, for our form or any other website |
| `POST /api/v1/files` | Upload a file of up to 4 MB in one request |
| `POST /api/v1/files/uploads` | Start an upload in pieces (large videos) |
| `PUT` / `POST` / `DELETE` `/api/v1/files/uploads/{id}` | Send a piece / finish / cancel |
| `GET` / `HEAD` `/api/v1/files/{id}` | Stream a photo or video (supports seeking) |
| `GET /api/v1/health` | Database status, latency, deployed version and region |

### `src/lib`: shared by browser and server

| By | Files |
|---|---|
| Vamshi | [constants.ts](../src/lib/constants.ts), [workflows.ts](../src/lib/workflows.ts), [money.ts](../src/lib/money.ts), [gst.ts](../src/lib/gst.ts), [subsidy.ts](../src/lib/subsidy.ts), [quote-calc.ts](../src/lib/quote-calc.ts), [warranty.ts](../src/lib/warranty.ts), [dates.ts](../src/lib/dates.ts), [validation/](../src/lib/validation/) (common, leads, surveys, quotes, inventory, jobs) |
| Hanvith | [format.ts](../src/lib/format.ts), [navigation.ts](../src/lib/navigation.ts), [query.ts](../src/lib/query.ts), [search.ts](../src/lib/search.ts), [utils.ts](../src/lib/utils.ts), [action-state.ts](../src/lib/action-state.ts) |

### `src/app`: pages (all Hanvith)

| Area | Contents |
|---|---|
| Root | `layout.tsx` (fonts, toasts), `globals.css` (design tokens, print styles), error and 404 pages, self-hosted Inter font |
| Public (no login) | `/` landing page and `/enquiry` form, with their own header and footer |
| Auth | `/login` |
| Sales | `/leads`, `/leads/[id]`, `/surveys`, `/surveys/[id]`, `/quotes`, `/quotes/new`, `/quotes/[id]`, `/quotes/[id]/print`, `/orders`, `/orders/[id]`, `/catalog` |
| Warehouse | `/inventory`, `/inventory/serials`, `/inventory/purchases`, `/inventory/purchases/new`, `/inventory/purchases/[id]`, `/dispatch`, `/dispatch/[orderId]` |
| Installations | `/my-work` (technician home), `/jobs` (crew calendar), `/jobs/[id]`, `/jobs/[id]/certificate` |
| Placeholders | `[...slug]` shows a "coming soon" card for dashboard, customers, service, invoices, subsidy and team |
| Loading and errors | A `loading.tsx` skeleton per route; if a page fails, `error.tsx` keeps the sidebar working |

### `src/components`: UI (all Hanvith)

| Folder | Contents |
|---|---|
| [ui/](../src/components/ui/) (19) | Building blocks on Radix: button, input, select, dialog, sheet, dropdown, command, table, tabs, card, badge, avatar, checkbox, label, progress, separator, skeleton, toasts, textarea |
| [shell/](../src/components/shell/) (6) | App frame, sidebar, mobile menu, account menu, ⌘K palette, frame skeleton |
| [shared/](../src/components/shared/) (21) | **Forms:** action form, action button, form field, submit button. **Lists:** filter tabs, search, pagination, empty state. **Pages:** header, section, detail list, stat card, status badge, timeline, skeletons. **Tools:** media uploader and gallery, signature pad, barcode scanner, copy and print buttons |
| [modules/leads/](../src/components/modules/leads/) (7) | Board, table, source and first-call badges, shared enquiry fields, lead forms, progress bar, new-lead dialog |
| [modules/surveys/](../src/components/modules/surveys/) (2) | The technician's phone form; the sales review |
| [modules/quotes/](../src/components/modules/quotes/) (3) | Quote builder, read-only parts list with totals, decline dialog |
| [modules/orders/](../src/components/modules/orders/) (3) | Record payment, cancel, progress stepper |
| [modules/inventory/](../src/components/modules/inventory/) (2) | Goods-receipt form, inventory sub-navigation |
| [modules/dispatch/](../src/components/modules/dispatch/) (3) | Packing bench, packing progress, dispatch and delivery dialogs |
| [modules/jobs/](../src/components/modules/jobs/) (3) | Completion form, reschedule dialog, agenda card |
| Other (3) | Public enquiry form, login form, logo |

### Scripts and tests (all Vamshi)

| File | Purpose |
|---|---|
| [seed.ts](../scripts/seed.ts) | Loads 20 staff (1 director, 2 sales, 15 technicians, 1 warehouse, 1 support), 30 products, 10 packages, opening stock, and 4 goods receipts with 181 serials. Safe to re-run; needs `--yes` for Atlas |
| [seed/catalog.ts](../scripts/seed/catalog.ts), [seed/users.ts](../scripts/seed/users.ts), [seed/inventory.ts](../scripts/seed/inventory.ts) | Catalog data and the package parts formula; staff list; goods receipts |
| [db-local.ts](../scripts/db-local.ts) | In-memory MongoDB for working offline |
| [check-lead-flow.ts](../scripts/check-lead-flow.ts), [check-sale-flow.ts](../scripts/check-sale-flow.ts), [check-ops-flow.ts](../scripts/check-ops-flow.ts) | Whole-flow checks against a real database: 10, 15 and 46 checks |
| [flows/order.ts](../scripts/flows/order.ts) | Builds a fresh confirmed order through the real services for the checks |
| [tests/unit/](../tests/unit/) | 22 unit tests: health-check error classifier (6) and warehouse and crew form validation (16) |

## 4. Functions

★ marks the functions that carry the core business rules.

### Domain rules in `src/lib` (Vamshi)

- **[workflows.ts](../src/lib/workflows.ts):**
  - `LEAD_FLOW` … `SUBSIDY_FLOW` list the allowed moves. For a lead: new → contacted → qualified → survey_scheduled → survey_completed → survey_approved → quoted → won or lost. For an order: pending_payment → confirmed → ready_to_dispatch → dispatched → delivered → installing → commissioned → closed.
  - `canTransition` answers "is this move allowed?". The UI uses it to decide which buttons to show.
- **[money.ts](../src/lib/money.ts):** `toPaise`, `toRupees`, `formatINR` (₹1,50,000), `formatINRCompact` (₹4.25 L, ₹1.2 Cr), `formatNumber`, `formatPercent`.
- **[gst.ts](../src/lib/gst.ts):**
  - `computeLine`: quantity × price, then GST at that line's rate.
  - ★ `summarize`: totals split into CGST and SGST (IGST for out-of-state buyers); the two halves always add up to the exact GST.
  - `gstBreakup`: rate-by-rate table for invoices.
- **[subsidy.ts](../src/lib/subsidy.ts):**
  - `isSubsidyEligible`: residential, on-grid systems only.
  - ★ `estimateSubsidyRs` / `estimateSubsidyPaise`: ₹30,000 per kW for the first 2 kW plus ₹18,000 for the 3rd, capped at ₹78,000. So 3 kW → ₹78,000.
- **[quote-calc.ts](../src/lib/quote-calc.ts)** (runs live in the browser and again on the server when saving):
  - `lineFromProduct`: turns a product into a priced line.
  - ★ `expandPackage`: turns a package into every one of its priced lines.
  - ★ `quoteTotals`: taxable value, GST, total, subsidy, cost to the customer after the subsidy, our cost and margin.
- **[warranty.ts](../src/lib/warranty.ts):**
  - `addMonths`: 31 Jan + 1 month gives 28/29 Feb, not 3 Mar.
  - `getWarrantyInfo`: "In warranty · 1 yr 4 mo left" or "Expired …".
  - `formatSpan`: the "1 yr 4 mo" text.
- **[dates.ts](../src/lib/dates.ts):**
  - `startOfDayIST`, `addDays`, `addHours`.
  - `getRange`: today, this week (from Monday) or this month, all in IST. `getPreviousRange` gives the period before.
  - `financialYear`: 31 Oct 2026 → "26-27".
- **[validation/](../src/lib/validation/):**
  - **Building blocks:** Indian mobile (10 digits starting 6–9), PIN code, GSTIN, rupees → paise.
  - **Leads:** e.g. `QualifyLeadSchema`, where the shadow-free area can't exceed the total roof area.
  - **Surveys:** e.g. `ReviewSurveySchema`, where a note is required unless approving.
  - **Quotes and payments:** e.g. `RecordPaymentSchema`, where a payment must link to an order or an invoice.
  - **Inventory:**
    - `normalizeSerial` trims and upper-cases a serial.
    - `splitSerials` splits a pasted list on spaces, commas or semicolons.
    - `ReceiveGoodsSchema`: 1–60 lines, whole units, cost of ₹0 or more.
    - Also the dispatch schema (vehicle and driver) and the delivery schema (who received the goods).
  - **Jobs:**
    - `RescheduleJobSchema`: 1–6 technicians.
    - `CompleteJobSchema`:
      - installed size 0.5–10 kW, and the generation test must be ticked;
      - 1–12 photos and a signature;
      - the missing items if the kit was incomplete, and a note for any extra cost;
      - refused while photos are still uploading.
- **[constants.ts](../src/lib/constants.ts):** every status, role and category with its label, badge colours (`STATUS_META`), company details and analytics event names.

### Platform (Vamshi)

| Function | What it does |
|---|---|
| `connectDB` | One cached connection per server (pool of 10, 30 s timeout, IPv4); retries on the next call if it failed |
| ★ `withTransaction(work)` | Runs `work` as one transaction: all writes succeed or none do |
| `AppError` | Typed error (`VALIDATION`, `NOT_FOUND`, `INVALID_STATE`, `INSUFFICIENT_STOCK`, `DISPATCH_INCOMPLETE`, …) that maps to an HTTP status |
| ★ `assertTransition` | Refuses illegal moves with a clear message, e.g. "This lead is New and cannot move to Quoted" |
| ★ `runAction(roles, work)` | Wraps every Server Action: session → role check (the director is always allowed) → database → run. Errors become friendly messages |
| `apiHandler`, `requireApiUser`, `jsonError`, `readJson`, `clientIp` | The same for REST routes, with JSON errors and 401/403 |
| `parseInput`, `parseForm`, `formToObject` | Zod validation with per-field messages |
| `actorRef`, `toObjectId`, `isObjectId` | Record "who did it" on each record |
| `rateLimit` | In-memory limit for public endpoints |
| `classifyDbError` | Turns a database failure into a safe reason (`auth_failed`, `dns`, `timeout`, …) |
| `trackServer` | Sends a PostHog event after the response, so it never slows the user; does nothing without a key |

### Auth (Vamshi)

- **`authorized`** runs on every page request:
  - A signed-in user opening /login is sent to their home page.
  - Public pages are allowed.
  - Everything else needs a sign-in.
- **`jwt` / `session` callbacks** put the user id and role into the cookie, so requests don't need a database lookup.
- **`authorize`** validates the input, finds an active user and checks the bcrypt password hash.
- **★ `getCurrentUser` / `requireUser(roles)`** return who is signed in (cached per request). They redirect to /login, or to the user's own home if their role isn't allowed.
- **`loginAction` / `logoutAction`** sign in and send each role to its home page: director → dashboard, sales → leads, technician → my work, warehouse → dispatch, support → service.

### Services (Vamshi)

**[leads.ts](../src/server/services/leads.ts)**

| Function | What it does |
|---|---|
| `listLeads` | Paged list; searches name, city and number, and phone from 4 digits; counts per status |
| `listLeadBoard` | Kanban columns; up to 40 cards per column; won and lost from the last 30 days |
| `getLeadPipelineStats` | Headline cards: not called within 2 hours, new this week, surveys to review, ready to quote |
| `getLeadDetail` | The lead with its customer, surveys, quotes and order, and whether it can be quoted (`canQuote`) |
| ★ `createLead` | Finds or creates the customer. **A repeat enquiry from the same phone within 30 days adds a note to the open lead instead of creating a duplicate.** Otherwise numbers and assigns the new lead |
| `pickSalesOwner` | The salesperson with the fewest open leads |
| `transition` | Moves the lead through `LEAD_FLOW` and records when it was first contacted |
| `markLeadContacted`, `qualifyLead`, `markLeadLost`, `reopenLead`, `assignLead` | One step each, with a timeline entry |
| ★ `scheduleSurvey` | Books a survey (not in the past, with an active technician); lead → survey_scheduled |

**[surveys.ts](../src/server/services/surveys.ts)**

| Function | What it does |
|---|---|
| `listSurveys` | Upcoming first; technicians see only their own |
| `getSurveyDetail` | The survey with its lead, customer, technician and reviewer |
| ★ `submitSurvey` | Every photo must be fully uploaded; only the assigned technician (or the director) may submit; saves the measurements; lead → survey_completed |
| ★ `reviewSurvey` | **Approve:** quoting unlocks. **Re-survey:** a new survey tomorrow at 10:00 IST with the same technician. **Not feasible:** the lead is closed as lost, with the reason |

**[quotes.ts](../src/server/services/quotes.ts)**

| Function | What it does |
|---|---|
| ★ `quoteGate` | Blocks quoting unless the lead is survey_approved or quoted **and** an approved survey exists |
| `getQuoteBuilderContext` | Catalog, a default package based on the survey's recommendation, or an earlier quote to revise |
| ★ `saveQuote` | Re-reads every product from the database (the browser may only change quantities and unit prices), recomputes totals, numbers the next version and sets 15-day validity; lead → quoted |
| `listQuotes`, `getQuoteDetail` | List with search; detail including our internal margin |
| `markQuoteSent`, `rejectQuote` | Status changes |
| ★ `acceptQuote` | Refuses expired quotes and declines the lead's other open quotes. Creates the order (awaiting payment) with a subsidy tracker if eligible; lead → won |

**Payments, orders and crew booking**

- **[payments.ts](../src/server/services/payments.ts) · ★ `recordPayment`:**
  - Refuses cancelled orders, ₹0 and overpayment, then records the payment.
  - On the first payment it confirms the order and builds the pick list from every non-service line.
  - It then books the installation through `pickCrew`.
  - Also: `listPayments`.
- **[core/crew.ts](../src/server/services/core/crew.ts) · ★ `pickCrew`:**
  - Starts from the preferred day, about four days out.
  - Looks for the first day (skipping Sundays, up to 14 days ahead) with three installers who have no other job, least-loaded first.
  - If there is none, it books the least-loaded crew on the preferred day, and the clash shows on the crew calendar.
  - Also: `busyTechnicianIds`.
- **[orders.ts](../src/server/services/orders.ts):**
  - `listOrders`.
  - `getOrderDetail`: the order with its customer, quote, job, crew, invoice and payments.
  - `cancelOrder`: refused once money has been received; otherwise returns reserved serials to stock and cancels the booked job.

**[inventory.ts](../src/server/services/inventory.ts)**

| Function | What it does |
|---|---|
| `listStock` | Per product: on hand (the ledger), reserved (on open pick lists), available, low-stock flag, and value at cost, with serialized units at their own goods-receipt cost |
| `listSerials` | Serial register with search and status filter |
| `listPurchases`, `getPurchase`, `listReceivableProducts` | Goods receipts, one receipt, and the products a receipt can include |
| ★ `receiveGoods` | Checks there is one serial per unit, no duplicates, no serial already registered, and no invoice date in the future. In one transaction it creates the receipt (SP-GRN-…), adds stock to the ledger, and registers each serial with its own cost and warranty months |

**[dispatch.ts](../src/server/services/dispatch.ts)**

| Function | What it does |
|---|---|
| `packingProgress`, `applyPackedStatus` | Counts scanned serials and ticked bulk lines; the order moves to Packed when complete and back to Confirmed if a unit is removed |
| `listDispatchQueue` | Three tabs: to pack (soonest installation first), in transit, delivered |
| `getDispatchDetail` | The packing bench data: lines, scanned serials, shelf stock, crew and invoice |
| ★ `scanSerial` | Allocates one unit to the order. It refuses an unknown serial, one already on this order, one packed for another order, one not in stock, the wrong product, or a line that is already full. It claims the unit atomically, so two people can't pack the same one |
| `unscanSerial`, `setBulkPicked` | Removes a unit (back to stock); ticks a bulk line, checking the shelf has enough |
| ★ `dispatchOrder` | Re-checks the pick list (`DISPATCH_INCOMPLETE` names what's missing), posts every line out of stock, marks serials Dispatched with the vehicle, and issues the GST tax invoice with serial numbers on the lines and payments so far applied |
| ★ `deliverOrder` | Starts each serial's warranty at the delivery date, for the months sold on the order. The timeline reads e.g. "6 panels to 31 Oct 2046 · 1 inverter to 31 Oct 2028" |

**[jobs.ts](../src/server/services/jobs.ts)**

| Function | What it does |
|---|---|
| `getJobCalendar` | Seven days (the Monday–Sunday week, or seven days from today) with every technician; flags a technician with two open jobs on one day |
| `getMyWork` | The technician's in-progress, today's and upcoming surveys and jobs, recently finished work and hours this month; flags "Kit not delivered yet" |
| `getJobDetail` | The job with its customer, order, crew, serials with warranty dates, the workmanship warranty, and bulk items offered as extra material |
| `rescheduleJob` | Before start only; not in the past; active technicians only. A double booking still saves, with a warning per person |
| ★ `startJob` | Only the booked crew (or the director); an installation only after delivery; order → Installing |
| ★ `completeJob` | Photos must be finished uploads; only the crew may complete. The finish must be after the start, not in the future, and at most 16 hours later; a different installed size needs a reason. Extra material leaves stock and is added to the order's costs. It saves the checklist, kit check and signature, logs hours for each crew member (to the quarter hour), marks serials Installed and the order Commissioned |
| `assertCrew` | Only the booked crew may start or complete |

**Other services**

- **Customers:** `upsertCustomerByPhone` reuses an existing record and fills in a missing email. `discomForCity` picks the electricity distributor (north Telangana → TSNPDCL, otherwise TSSPDCL).
- **Catalog and staff:** `getActiveCatalog`, `listPackagesWithPricing`, `listProducts` (stock, reserved, low-stock flag, margin %), `listStaff`.
- **Timelines:** `logActivity`, `listActivity`, `listCustomerActivity`.
- **Numbering:** `nextSequence` (atomic increment), `nextNumber` (SP-L-0001), `nextInvoiceNumber` (INV/26-27/0001, restarts every April).
- **★ `moveStock`:** changes stock atomically, never below zero, and writes the ledger. Used by goods receipts, dispatch and extra material on site.
- **★ `issueInvoice`:** CGST and SGST, or IGST depending on the customer's state; due in 15 days. Used at dispatch.
- **Media** ([core/files.ts](../src/server/services/core/files.ts)):
  - `saveSmallFile`: files up to 4 MB in one request.
  - `createUpload` → `writePiece` × n → `completeUpload` / `abortUpload`: big files in ~4 MB pieces; safe to retry.
  - `sniffType`: checks the bytes actually match the declared type.
  - `openFileStream`: streams with seeking. Also `deleteFile`.
  - `cleanupStaleUploads`: removes uploads abandoned for 6 hours.

### Actions (Vamshi)

Every action follows the same pattern: `runAction(roles)` → `parseForm(schema)` → service → `revalidatePath` (refresh the affected pages) → `trackServer`. The director passes every role check.

| File | Actions (who may call them) |
|---|---|
| [leads.ts](../src/server/actions/leads.ts) | `createLeadAction`, `markContactedAction`, `markLeadLostAction` (sales, support); `qualifyLeadAction`, `reopenLeadAction`, `assignLeadAction`, `scheduleSurveyAction` (sales) |
| [surveys.ts](../src/server/actions/surveys.ts) | `submitSurveyAction` (technician; waits until photos finish uploading), `reviewSurveyAction` (sales) |
| [quotes.ts](../src/server/actions/quotes.ts) | `saveQuoteAction` (JSON from the builder), `markQuoteSentAction`, `acceptQuoteAction` (then opens the new order), `rejectQuoteAction` (all sales) |
| [orders.ts](../src/server/actions/orders.ts) | `recordPaymentAction` (sales, support; the payment date can't be in the future), `cancelOrderAction` (director only) |
| [inventory.ts](../src/server/actions/inventory.ts) | `receiveGoodsAction` (JSON from the receipt form), `scanSerialAction`, `unscanSerialAction`, `bulkPickAction`, `dispatchOrderAction`, `deliverOrderAction` (all warehouse) |
| [jobs.ts](../src/server/actions/jobs.ts) | `rescheduleJobAction` (sales), `startJobAction`, `completeJobAction` (technician) |
| [public.ts](../src/server/actions/public.ts) | `submitEnquiryAction` (no login; 5 per 10 minutes per IP; a hidden spam-trap field gets a fake success) |

### UI (Hanvith)

**Pages.** Every page follows the same pattern: `requireUser(roles)` → read the URL filters → call services in parallel → render. For example, `LeadsPage` shows the board or the table (`?view=table`) and supports `?mine=1`, `?status=` and `?q=`. `JobsPage` shows each technician only their own row.

| Component | Key functions |
|---|---|
| QuoteBuilder | `choosePackage` fills the full parts list; `updateLine` and `addLine` edit it; totals update live through `quoteTotals`; `save(send)` calls `saveQuoteAction` and opens the saved quote |
| PackingBench | Scan with the camera (`BarcodeScanner`) or type a serial → `scanSerialAction`; a large banner shows the server's reason for any refusal; tick bulk lines |
| GrnForm | One line per product, quantity and unit cost. Serials are scanned off the boxes, typed, or pasted (`splitSerials`); the counter turns green when the serials match the quantity. Posts JSON to `receiveGoodsAction` |
| CompleteJobForm | Times, installed size (with a reason if different), generation test, checklist, kit check, extra material, photos (`MediaUploader`) and the customer's signature (`SignaturePad`) |
| RescheduleJobDialog | Marks technicians already booked that day; saving still works, and the toast names the double booking |
| WorkCard | One agenda item: when, where (maps link), who to call, and what's blocking it |
| MediaUploader | `classifyFile`; `compressImage` (1600 px, JPEG 80%, keeps photo orientation); `uploadDirect` or `uploadChunked`; `withRetries` (3 tries); 2 uploads at a time; blocks submit until uploads finish |
| ActionForm / ActionButton | `useActionFormState`, `toastActionResult`, `useFieldError`: the server's message becomes a toast, and errors show under each field |
| CommandPalette | ⌘K / Ctrl+K: quick actions and pages for the user's role. Record search calls `/api/v1/search`, which comes in Phase 3; until then it shows a short inline message |
| SidebarNav / MobileNav | `navForRole` filters the menu; `isNavItemActive` highlights the current page |
| LoginForm | Demo-account shortcuts; only internal `callbackUrl` redirects |

**Helper files:**

- [format.ts](../src/lib/format.ts): IST dates, phone formatting, WhatsApp and call links, kW display.
- [navigation.ts](../src/lib/navigation.ts): `canAccess` (the director can open everything), `navForRole`, `roleHome`.
- [query.ts](../src/lib/query.ts): `hrefWith` changes one URL parameter and keeps the rest.

### Scripts and tests (Vamshi)

- **`seed.ts`:**
  - `main` refuses a remote database without `--yes`, upserts the staff and prints the demo logins.
  - `seedCatalog` bulk-upserts products, packages and opening stock.
  - `seedPurchases` receives the goods receipts through the real `receiveGoods` service, skipping any supplier invoice already on file.
- **Seed data helpers:**
  - `bom(kw, type)` is the package parts formula. Panels = ⌈kW × 1000 ÷ 545⌉, and on-grid systems add a net meter.
  - `grnSerials` makes repeatable serials like `WAA545-2609-0001`.
- **Shared flow helper:** `makeConfirmedOrder` builds an order from a fresh enquiry, using the same services the screens call.
- **Flow checks:** each `main` runs a whole flow against a real database. `expectError` confirms illegal moves are refused, for example:
  - "can't accept twice", "overpayment rejected";
  - "wrong product refused", "dispatch blocked before packing";
  - "start blocked until the kit is delivered".
- **Unit tests:** they feed the form schemas exactly what the browser posts, so a renamed field or a checkbox quirk fails in CI rather than on a roof.

## 5. Who built what

Numbers are from `git blame` (who wrote each line in the code today) and `git shortlog`, at `b799ac3`.

| | Hanvith Sai Alla | Lagishetty Vamshi |
|---|---|---|
| Role | Product, architecture, frontend | Backend, database, integration, tests |
| Code | 142 files · 12,788 lines | 86 files · 9,828 lines |
| Commits (incl. merges) | 58 | 66 |
| Code owned | All pages and components, design system, formatting and navigation helpers, project config | Models, services, actions, auth, API routes, business rules in `src/lib`, seed and checks, tests, CI, Vercel config |
| Docs | Plan, README, handoff log, all six product docs, Architecture, Engineering, this file, most of Setup | API.md, DB.md, parts of Setup and Human_Tasks |

**Branches.** 22 feature branches, each merged into `main` with a merge commit:

| Written by | Merged by | Branches |
|---|---|---|
| Hanvith | Vamshi | `chore/project-setup`, `docs/product-plan`, `feat/ui-shell`, `feat/quotes-ui` |
| Vamshi | Hanvith | `feat/db-core`, `feat/auth`, `chore/ci`, `feat/seed-users`, `feat/leads-api`, `feat/catalog-quotes-api` |
| Both | Hanvith | `feat/domain-lib`, `chore/deployment-config`, `feat/media-pipeline`, `chore/mumbai-region-health`, `feat/jobs-ui` |
| Both | Vamshi | `docs/engineering`, `feat/leads-ui`, `docs/phase-1-sync` |
| Hanvith | Hanvith | `docs/brief-audit`, `feat/dispatch-ui` |
| Vamshi | Vamshi | `feat/inventory-api`, `feat/jobs-api` |
