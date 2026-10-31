# Codebase.md: The code from the top down

| | |
|---|---|
| **Snapshot** | `main` at `ba6fbab`, 31 Oct 2026 (end of Phase 4: hardening), plus the 1 Nov work: analytics and privacy (consent, CTAs, heatmaps, web vitals) and the "Energy in motion" redesign (SunPower rebrand, landing page, lifecycle shell, dashboard pipeline, Reports, page transitions, account menu in the sidebar). Section 5 numbers are at `ba6fbab` |
| **Owner** | Hanvith Sai Alla |
| **Related** | [Architecture.md](Architecture.md) · [Engineering.md](Engineering.md) · [API.md](API.md) · [DB.md](DB.md) · [Plan.md](../Plan.md) |

Read this in four passes: the big picture, the modules, the files, then the functions that carry the business rules. Section 5 shows who built what, taken from `git blame` and the branch history.

**Size:** 299 code files, about 31,600 lines (not counting docs, the brief PDF and `package-lock.json`).

**Keeping it current:** when a module ships, add its files and functions here in the same pull request and refresh the numbers in section 5.

## 1. The big picture

SunPower is one Next.js 16 application. The screens and the backend live in one repository and deploy together to Vercel, with functions in Mumbai (`bom1`). All data, including photos and videos, is in one MongoDB Atlas database, also in Mumbai.

```
 Browser: director · sales · technician (phone) · warehouse · support · homeowner
    │      instrumentation-client.ts → PostHog only after cookie consent (via /ingest)
    ▼
 proxy.ts ── staff page while signed out? → /login        (checks the cookie only, no DB)
    │
    ├── Pages           src/app/**/page.tsx      read data, render on the server
    ├── Server Actions  src/server/actions/*     every form and button that changes data
    └── REST API        src/app/api/v1/*         enquiries, warranty lookup, search, files,
                   │                             CSV reports, health
                   ▼
    Services  src/server/services/*   ← all business rules live here
                   │
    Models    src/server/models/*     18 Mongoose schemas
                   │
                   ▼
    MongoDB Atlas: 18 collections + GridFS "media" bucket (photos, videos)

 src/lib/*  used by BOTH browser and server: statuses, state machines, money,
            GST, subsidy, quote maths, warranty, costing, crew choice,
            analytics contract, validation, formatting
 instrumentation.ts  unhandled server errors → PostHog $exception
```

### Rules that hold it together

1. **Layers.** Pages and components never query the database; they call services. Actions and API routes are thin: check the role, validate the input, call one service, refresh the affected pages, record an analytics event.
2. **State machines.** Every status change (lead, survey, quote, order, job, ticket, subsidy) is checked against the allowed moves in [workflows.ts](../src/lib/workflows.ts), so a rule like "no quote before an approved survey" lives in one place.
3. **Transactions.** A change that touches several records runs as one MongoDB transaction: all of it happens or none of it does.
4. **Money in paise.** Amounts are stored as whole paise (₹1 = 100 paise), so totals never drift. GST is calculated per line and split into CGST and SGST.
5. **Audit trail.** Every change writes an Activity record. These records are the timelines on each page.
6. **One validation contract.** The same Zod schemas check input in the browser and again on the server.
7. **Readable numbers.** SP-L-0042 (lead), SP-SV, SP-Q, SP-O, SP-PAY, SP-J, SP-T (ticket), SP-GRN and INV/26-27/0001 come from atomic counters, so two people never get the same number.
8. **Gates the server enforces:**
   - No quote before an approved survey; a quote missing a part its package needs is sent only with an explicit OK.
   - No dispatch until every serial is scanned and every bulk line is ticked.
   - No installation start before delivery.
   - No completion without photos and the customer's signature.
   - No ticket closed until the customer confirms it works.
9. **Pure rules are testable.** The maths behind quotes, warranties, costing and crew choice lives in `src/lib` with no database access, so 128 unit tests cover it directly.
10. **Privacy by default.** Browser analytics start only after opt-in cookie consent. Analytics never carry names, phones, serials or search text; clicks are captured without text or attributes, URLs are scrubbed and session replay masks contact details. Share links and the public warranty page mask customer names.
11. **Fast pages.** A static frame appears instantly and the data streams in. Every staff route has a loading skeleton.

### One order, end to end

| Step | Who | What the code does | Main functions |
|---|---|---|---|
| 1. Enquiry | Homeowner | Finds or creates the customer by phone. A repeat enquiry within 30 days joins the open lead. A new lead goes to the salesperson with the fewest open leads | `submitEnquiryAction` → `createLead` |
| 2. Qualify, book survey | Sales | Records roof area, shadow-free area, monthly bill and grid suitability; books a technician | `qualifyLead`, `scheduleSurvey` |
| 3. Site survey | Technician, sales | The technician saves direction, tilt, shading, cable distance and photos. Sales approval unlocks quoting | `submitSurvey`, `reviewSurvey` |
| 4. Quote | Sales | A package expands into the full parts list. The server re-prices every line and adds GST and the subsidy. Sending a quote without, say, the earthing kit needs an explicit OK | `saveQuote`, `quoteTotals`, `missingComponents` |
| 5. Customer accepts | Sales | Creates the order (awaiting payment) and its subsidy tracker; the lead is won | `acceptQuote` |
| 6. First payment | Sales | Confirms the order and builds the warehouse pick list. If the order sells installation, it books three installers who are free on a day about four days out; a hardware-only Panel Set gets no crew | `recordPayment`, `pickCrew` → `chooseCrew` |
| 7. Goods receipt | Warehouse | Registers every serial number with its own purchase cost and adds the stock to the ledger | `receiveGoods` |
| 8. Packing | Warehouse | Each scan allocates one unit to the order; bulk lines are ticked; the order becomes Packed by itself | `scanSerial`, `setBulkPicked` |
| 9. Dispatch | Warehouse | Re-checks the pick list, moves the stock out and issues the GST tax invoice with payments so far applied | `dispatchOrder`, `issueInvoice` |
| 10. Delivery | Warehouse | Starts every serial's warranty from the delivery date (panels 20 years, inverter 2 years). A Panel Set with nothing to install closes here | `deliverOrder` |
| 11. Installation | Crew | Start is allowed only after delivery. Completion needs times, size, generation test, photos and the signature; the form keeps a local draft on the phone. Serials become Installed, the order Commissioned, and hours are logged per technician | `startJob`, `completeJob` |
| 12. Certificate | Staff, customer | Every serial with its warranty end date, the workmanship warranty, the crew, photos and the signature. "Send on WhatsApp" gives the customer a 90-day read-only link | `certificateLink`, `/share/[token]` |
| 13. Subsidy | Sales | PM Surya Ghar stages in order, with papers photographed onto the file; a warning while DISCOM feasibility is pending | `advanceSubsidy`, `addSubsidyDocuments` |
| 14. Breakdown, months later | Support, technician | ⌘K by phone, name or serial; the warranty is decided on the spot (per serial, or the workmanship warranty for wiring faults). In warranty the customer pays ₹0 and the cost is charged to this installation's profit; out of warranty the GST service invoice is issued automatically. Closed only after the customer confirms | `searchRecords`, `createTicket`, `resolveTicket`, `confirmTicket` |
| 15. Month-end | Director | Profit per installation from actual costs (losers first, with the cause), unfinished steps, advances held, repairs, subsidy, payroll; a read-only share link and CSVs | `getDashboard`, `costFromActuals`, `getPayroll` |

## 2. Modules

| # | Module | What it does | Built by | Status |
|---|---|---|---|---|
| 1 | Platform core | DB connection, typed errors, action and API wrappers, health check, CSV writer | Vamshi | ✅ |
| 2 | Auth and roles | Login, 12-hour sessions carrying the role, route guard, role-based menus and home pages | Vamshi (backend), Hanvith (login screen, menus) | ✅ |
| 3 | Domain library | Statuses, state machines, money, GST, subsidy, quote maths, warranty, costing, crew choice, IST dates, validation | Vamshi (rules), Hanvith (formatting, navigation) | ✅ |
| 4 | Leads | Enquiries from every channel (with business GSTIN), duplicate merge, auto-assignment, 2-hour first-call deadline, qualification, survey booking | Vamshi (logic), Hanvith (screens) | ✅ |
| 5 | Site surveys | Technician's on-roof form with photos; sales approves, asks for a re-survey or closes the lead | Both | ✅ |
| 6 | Catalog and quotes | 30 products and 15 packages (On-Grid, Off-Grid, Panel Set); the builder fills in the full parts list; missing-parts gate; GST, subsidy, margin; print view | Both | ✅ |
| 7 | Orders and payments | An accepted quote becomes an order; the first payment confirms it, builds the pick list and books the crew if installation is sold | Both | ✅ |
| 8 | Inventory | Stock with reserved and available quantities and value at cost; serial register with history; goods receipts; stock corrections and serial write-offs | Both | ✅ |
| 9 | Dispatch | Packing bench with camera scanning, dispatch gate, tax invoice at dispatch, delivery starts the warranties | Both | ✅ |
| 10 | Installations | Crew calendar with clash highlights, the technician's "My work", start gate, completion proof with a local draft, certificate and customer link | Both | ✅ |
| 11 | Media | Photos and videos in GridFS: compressed in the browser, large files uploaded in pieces, streamed with seeking; certificate photos visible through the share token | Both | ✅ |
| 12 | Public website | Landing page (interactive energy-flow diagram, subsidy estimator, journey, systems, FAQ), enquiry form, enquiry API, public warranty check, privacy notice, cookie banner, rate limits, spam trap | Both | ✅ |
| 13 | App shell and design system | Layouts, sidebar, mobile menu, ⌘K palette, forest-and-sunlight tokens at WCAG AA (Style_Guide v2), 19 UI primitives, 23 shared components | Hanvith | ✅ |
| 14 | Search | ⌘K across customers, leads, quotes, orders, serials (last 4+ characters), tickets and invoices, filtered by role | Vamshi (API), Hanvith (palette) | ✅ |
| 15 | Service desk | Tickets with the warranty decided at creation, visits on the technician's calendar, parts and replacements, ₹0 repairs costed to the installation, auto service invoice, confirm-before-close, CSV | Both | ✅ |
| 16 | Customers | Customer list and Customer 360: orders, every serial with its warranty, tickets, invoices, payments, timeline | Both | ✅ |
| 17 | Finance | Invoices list and printable GST invoice, subsidy board with papers, technician payroll, CSV exports | Both | ✅ |
| 18 | Director's dashboard | KPIs for today/week/month, 12-month trend, profit per job from actuals, unfinished steps, repairs, subsidy; masked share links | Both | ✅ |
| 19 | Analytics and consent | Typed event contract, server events after each change; browser SDK only after opt-in consent, with masked click capture and named CTAs, heatmaps, rage/dead clicks, Core Web Vitals, staff replays; error reporting | Both | ✅ Live (1 Nov additions not yet pushed) |
| 20 | Data, quality and delivery | Seed with 14 months of history and a live pipeline, 5 flow checks (148 checks), 128 unit tests, CI, Vercel config | Vamshi | ✅ |

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
| [instrumentation-client.ts](../src/instrumentation-client.ts) | Runs before the app is interactive: starts PostHog if the visitor accepted cookies earlier, and starts or stops it when the choice changes | Hanvith |
| [instrumentation.ts](../src/instrumentation.ts) | `onRequestError`: unhandled server errors go to PostHog as `$exception` | Vamshi |

### `src/server`: backend (all Vamshi)

**Models** (11 files, 18 models)

| File | Models | Key points |
|---|---|---|
| [user.ts](../src/server/models/user.ts) | User | Password hash hidden by default; role, skills, hourly rate |
| [crm.ts](../src/server/models/crm.ts) | Customer, Lead, Survey | One customer per phone number; the lead holds the requirement, qualification and GSTIN; the survey holds measurements and photo ids |
| [catalog.ts](../src/server/models/catalog.ts) | Product, Package | SKU, cost, price, GST %, HSN, warranty months, stock; a package is a parts-list template |
| [sales.ts](../src/server/models/sales.ts) | Quote, Order, Payment | Lines are price snapshots; the order holds the pick list, dispatch details, subsidy tracker with photographed papers, and extra costs tagged `site` or `warranty` |
| [inventory.ts](../src/server/models/inventory.ts) | SerialUnit, StockMove, Purchase | One record per serial number with its cost, history, warranty dates and replacement links; append-only stock ledger; goods receipts |
| [operations.ts](../src/server/models/operations.ts) | Job | Installation or service visit: crew, start and finish, checklist, kit check, extra material, photos, signature, time logs |
| [service.ts](../src/server/models/service.ts) | Ticket | Warranty state and basis (serial or workmanship) captured at creation; billing override with reason; resolution with parts, labour and replacement; customer confirmation; cost absorbed |
| [finance.ts](../src/server/models/finance.ts) | Invoice, ShareLink | CGST/SGST/IGST totals; expiring, revocable links scoped to the dashboard or one job's certificate |
| [system.ts](../src/server/models/system.ts) | Counter, Activity | Document numbers; audit log |
| [shared.ts](../src/server/models/shared.ts), [index.ts](../src/server/models/index.ts) | — | Reusable address and line-item parts; single import point |

**Services** (the business rules)

| File | Responsibility |
|---|---|
| [leads.ts](../src/server/services/leads.ts) | Lists, board, headline stats, detail; create, contact, qualify, lose, reopen, assign, book survey |
| [surveys.ts](../src/server/services/surveys.ts) | Lists and detail; the technician's submission; the sales review |
| [quotes.ts](../src/server/services/quotes.ts) | Survey gate, builder data, missing-parts check, save, list, detail, send, decline, accept → order |
| [orders.ts](../src/server/services/orders.ts) | List, detail, cancel |
| [payments.ts](../src/server/services/payments.ts) | Record a payment (the first one confirms the order and books the crew if installation is sold); list payments |
| [inventory.ts](../src/server/services/inventory.ts) | Stock levels and value, serial register, goods receipts, stock corrections, serial write-offs |
| [dispatch.ts](../src/server/services/dispatch.ts) | Packing (scan, un-scan, tick), dispatch, delivery (closes hardware-only orders) |
| [jobs.ts](../src/server/services/jobs.ts) | Crew calendar, "My work", job detail, reschedule, start, complete |
| [tickets.ts](../src/server/services/tickets.ts) | Warranty decision, ticket preview, create, assign visit, start, billing override, resolve, confirm, close, reopen, list, detail, CSV rows |
| [search.ts](../src/server/services/search.ts) | ⌘K search across seven record types, filtered by role |
| [warranty.ts](../src/server/services/warranty.ts) | Public warranty lookup by serial, or by phone plus the last 4 characters of a serial |
| [customers.ts](../src/server/services/customers.ts) | Find or create a customer by phone; DISCOM by city; customer list; Customer 360 |
| [costing.ts](../src/server/services/costing.ts) | Gathers actual costs for orders (serial GRN costs, time logs × rates) and hands them to `lib/costing` |
| [dashboard.ts](../src/server/services/dashboard.ts) | KPIs, 12-month trend, profit table, unfinished steps, repairs by age, subsidy pipeline, lifecycle pipeline |
| [reports.ts](../src/server/services/reports.ts) | Twelve IST months: installations and kW per month, invoiced and cash per month, the enquiry funnel (survey, quote, won), sources and wins, system mix, margin bands, revenue split from job costing, tickets raised/closed and by category |
| [finance.ts](../src/server/services/finance.ts) | Invoices and CSV rows, subsidy stages and papers, payroll, dashboard and certificate share links |
| [catalog.ts](../src/server/services/catalog.ts) | Active catalog, priced packages, products with stock and margin |
| [users.ts](../src/server/services/users.ts) | Staff list for pickers |
| [core/crew.ts](../src/server/services/core/crew.ts) | Loads installers, their load and busy days, then calls `chooseCrew` |
| [core/activity.ts](../src/server/services/core/activity.ts) | Writes and reads timelines |
| [core/counters.ts](../src/server/services/core/counters.ts) | SP-… and INV/26-27/… numbers |
| [core/stock.ts](../src/server/services/core/stock.ts) | The only way stock changes |
| [core/invoicing.ts](../src/server/services/core/invoicing.ts) | Issues a GST tax invoice (sale or service) |
| [core/files.ts](../src/server/services/core/files.ts) | Media storage: validate, store, upload in pieces, stream, delete |

**Also in `src/server`:**

- **Actions** ([src/server/actions/](../src/server/actions/)): auth, leads, surveys, quotes, orders, inventory, jobs, service, finance, public. These are the entry points the UI calls for every change.
- **Auth:** [auth.config.ts](../src/server/auth/auth.config.ts) (rules light enough to run on every request), [config.ts](../src/server/auth/config.ts) (password check against the database), [session.ts](../src/server/auth/session.ts) (`requireUser`), plus [proxy.ts](../src/proxy.ts) and [next-auth.d.ts](../src/types/next-auth.d.ts).
- **Helpers** ([src/server/lib/](../src/server/lib/)): action.ts, api.ts, validate.ts, actor.ts, rate-limit.ts, db-errors.ts, csv.ts. Plus [db.ts](../src/server/db.ts), [errors.ts](../src/server/errors.ts) and [analytics.ts](../src/server/analytics.ts).

### `src/app/api`: REST endpoints (all Vamshi)

| Route | Purpose |
|---|---|
| `/api/auth/*` | Auth.js sign-in and session endpoints |
| `POST /api/v1/enquiries` | Public enquiry, for our form or any other website |
| `POST /api/v1/warranty` | Public warranty lookup; 10 per IP per hour; every miss gets the same 404 |
| `GET /api/v1/search?q=` | ⌘K search for the signed-in role |
| `GET /api/v1/reports/profit` | Profit per installation as CSV; the director signed in, or a dashboard share token (names masked) |
| `GET /api/v1/reports/payroll` | Technician payout for a month as CSV (director) |
| `GET /api/v1/reports/invoices`, `/tickets` | Invoice and ticket lists as CSV (sales and support; support) |
| `POST /api/v1/files` | Upload a file of up to 4 MB in one request |
| `POST /api/v1/files/uploads` | Start an upload in pieces (large videos) |
| `PUT` / `POST` / `DELETE` `/api/v1/files/uploads/{id}` | Send a piece / finish / cancel |
| `GET` / `HEAD` `/api/v1/files/{id}` | Stream a photo or video (supports seeking); signed out only with that job's certificate token |
| `GET /api/v1/health` | Database status, latency, deployed version and region |

### `src/lib`: shared by browser and server

| By | Files |
|---|---|
| Vamshi | [constants.ts](../src/lib/constants.ts), [workflows.ts](../src/lib/workflows.ts), [money.ts](../src/lib/money.ts), [gst.ts](../src/lib/gst.ts), [subsidy.ts](../src/lib/subsidy.ts), [quote-calc.ts](../src/lib/quote-calc.ts), [warranty.ts](../src/lib/warranty.ts), [costing.ts](../src/lib/costing.ts), [crew.ts](../src/lib/crew.ts), [analytics.ts](../src/lib/analytics.ts), [dates.ts](../src/lib/dates.ts), [validation/](../src/lib/validation/) (common, leads, surveys, quotes, inventory, jobs, service, finance, warranty) |
| Hanvith | [format.ts](../src/lib/format.ts), [navigation.ts](../src/lib/navigation.ts), [query.ts](../src/lib/query.ts), [search.ts](../src/lib/search.ts), [utils.ts](../src/lib/utils.ts), [action-state.ts](../src/lib/action-state.ts), [analytics-client.ts](../src/lib/analytics-client.ts), [consent.ts](../src/lib/consent.ts) |

### `src/app`: pages (all Hanvith)

| Area | Contents |
|---|---|
| Root | `layout.tsx` (IBM Plex Sans and Bricolage Grotesque, toasts, cookie banner), `globals.css` (design tokens at WCAG AA, print styles), error and 404 pages, `global-error.tsx` (styled fallback if the root layout fails), self-hosted Inter font |
| Public (no login) | `/` landing page, `/enquiry` form, `/warranty` check, `/privacy` notice, `/share/[token]` (read-only dashboard or one customer's certificate) |
| Auth | `/login` |
| Director | `/dashboard`, `/reports` (12-month analytics), `/team` (payroll) |
| Sales | `/leads`, `/leads/[id]`, `/surveys`, `/surveys/[id]`, `/quotes`, `/quotes/new`, `/quotes/[id]`, `/quotes/[id]/print`, `/orders`, `/orders/[id]`, `/catalog`, `/customers`, `/customers/[id]`, `/invoices`, `/invoices/[id]`, `/subsidy` |
| Warehouse | `/inventory`, `/inventory/serials`, `/inventory/purchases`, `/inventory/purchases/new`, `/inventory/purchases/[id]`, `/dispatch`, `/dispatch/[orderId]` |
| Installations | `/my-work` (technician home), `/jobs` (crew calendar), `/jobs/[id]`, `/jobs/[id]/certificate` |
| Service | `/service`, `/service/new` (warranty first, then the ticket), `/service/[id]` |
| Loading and errors | A `loading.tsx` skeleton per route; if a page fails, `error.tsx` keeps the sidebar working and reports the error |

### `src/components`: UI (all Hanvith)

| Folder | Contents |
|---|---|
| [ui/](../src/components/ui/) (19) | Building blocks on Radix: button, input, select, dialog, sheet, dropdown, command, table, tabs, card, badge, avatar, checkbox, label, progress, separator, skeleton, toasts, textarea |
| [shell/](../src/components/shell/) (6) | App frame, sidebar, mobile menu, account menu, ⌘K palette, frame skeleton |
| [shared/](../src/components/shared/) (23) | **Forms:** action form, action button, form field, submit button. **Lists:** filter tabs, URL select (`ParamSelect`), search, pagination, empty state. **Pages:** header, section, detail list, stat card, status badge, timeline, skeletons. **Tools:** media uploader and gallery, signature pad, barcode scanner, copy and print buttons. **Privacy:** cookie banner and Cookie settings button |
| [modules/leads/](../src/components/modules/leads/) (7) | Board, table, source and first-call badges, shared enquiry fields, lead forms, progress bar, new-lead dialog |
| [modules/surveys/](../src/components/modules/surveys/) (2) | The technician's phone form; the sales review |
| [modules/quotes/](../src/components/modules/quotes/) (3) | Quote builder (with the missing-parts warning), read-only parts list with totals, decline dialog |
| [modules/orders/](../src/components/modules/orders/) (3) | Record payment, cancel, progress stepper (with subsidy and Panel Set paths) |
| [modules/inventory/](../src/components/modules/inventory/) (3) | Goods-receipt form, inventory sub-navigation, stock correction and write-off dialogs |
| [modules/dispatch/](../src/components/modules/dispatch/) (3) | Packing bench, packing progress, dispatch and delivery dialogs |
| [modules/jobs/](../src/components/modules/jobs/) (4) | Completion form (with local draft), reschedule dialog, agenda card, certificate view shared by staff and the customer link |
| [modules/service/](../src/components/modules/service/) (2) | Warranty card, ticket forms for each state |
| [modules/dashboard/](../src/components/modules/dashboard/) (4) | Lifecycle pipeline, dashboard view, revenue trend chart, share panel |
| [modules/reports/](../src/components/modules/reports/) (1) | Report charts: column (one series, optional emphasis), two-line, ranked bars, segmented bar; validated categorical palette |
| [modules/finance/](../src/components/modules/finance/) (2) | Subsidy stage and papers dialogs |
| [modules/public/](../src/components/modules/public/) (4) | Energy-flow diagram, subsidy estimator, public enquiry form, warranty lookup |
| Other (2) | Login form, logo |

### Scripts and tests (all Vamshi)

| File | Purpose |
|---|---|
| [seed.ts](../scripts/seed.ts) | Loads 20 staff (1 director, 2 sales, 15 technicians, 1 warehouse, 1 support), 30 products, 15 packages, opening stock, 4 goods receipts with 181 serials, 14 months of history and today's pipeline. Safe to re-run; needs `--yes` for Atlas |
| [seed/catalog.ts](../scripts/seed/catalog.ts), [seed/users.ts](../scripts/seed/users.ts), [seed/inventory.ts](../scripts/seed/inventory.ts) | Catalog data and the package parts formula; staff list; goods receipts |
| [seed/history.ts](../scripts/seed/history.ts) | 121 finished installations with real dates, written straight into the collections; loss-making jobs have a visible cause |
| [seed/pipeline.ts](../scripts/seed/pipeline.ts) | Today's open leads, orders and tickets, created through the real services |
| [seed/people.ts](../scripts/seed/people.ts) | Telangana customers and places from a seeded random generator, so every run is identical |
| [db-local.ts](../scripts/db-local.ts) | In-memory MongoDB for working offline |
| [check-lead-flow.ts](../scripts/check-lead-flow.ts), [check-sale-flow.ts](../scripts/check-sale-flow.ts), [check-ops-flow.ts](../scripts/check-ops-flow.ts), [check-service-flow.ts](../scripts/check-service-flow.ts), [check-finance-flow.ts](../scripts/check-finance-flow.ts) | Whole-flow checks against a real database: 10, 18, 55, 29 and 36 checks (148) |
| [flows/order.ts](../scripts/flows/order.ts) | Builds a fresh confirmed order through the real services for the checks |
| [tests/unit/](../tests/unit/) | 128 unit tests in 11 files: quote maths (14), state machines (19), warranty dates (13), costing and crews (12), analytics privacy (11), cookie consent (4), operations forms (19), sales checks (13), service forms (11), finance extras (6), DB errors (6) |

## 4. Functions

★ marks the functions that carry the core business rules.

### Domain rules in `src/lib` (Vamshi)

- **[workflows.ts](../src/lib/workflows.ts):**
  - `LEAD_FLOW` … `SUBSIDY_FLOW` list the allowed moves. For a lead: new → contacted → qualified → survey_scheduled → survey_completed → survey_approved → quoted → won or lost. For an order: pending_payment → confirmed → ready_to_dispatch → dispatched → delivered → installing → commissioned → closed (a Panel Set goes delivered → closed). For a ticket: open → assigned → in_progress → resolved → customer_confirmed → closed, with "Not fixed" back to in_progress.
  - `canTransition` answers "is this move allowed?". The UI uses it to decide which buttons to show.
- **[money.ts](../src/lib/money.ts):** `toPaise`, `toRupees`, `formatINR` (₹1,50,000), `formatINRCompact` (₹4.25 L, ₹1.2 Cr), `formatNumber`, `formatPercent`.
- **[gst.ts](../src/lib/gst.ts):**
  - `computeLine`: quantity × price, then GST at that line's rate.
  - ★ `summarize`: totals split into CGST and SGST (IGST for out-of-state buyers); the two halves always add up to the exact GST.
  - `gstBreakup`: rate-by-rate table for invoices.
- **[subsidy.ts](../src/lib/subsidy.ts):**
  - `isSubsidyEligible`: residential, on-grid systems only.
  - ★ `estimateSubsidyRs` / `estimateSubsidyPaise`: ₹30,000 per kW for the first 2 kW plus ₹18,000 for the 3rd, capped at ₹78,000. So 3 kW → ₹78,000.
  - `feasibilityPending`: the DISCOM hasn't approved feasibility yet, so installing now could cost the customer the subsidy.
- **[quote-calc.ts](../src/lib/quote-calc.ts)** (runs live in the browser and again on the server when saving):
  - `lineFromProduct`: turns a product into a priced line.
  - ★ `expandPackage`: turns a package into every one of its priced lines.
  - ★ `quoteTotals`: taxable value, GST, total, subsidy, cost to the customer after the subsidy, our cost and margin.
  - ★ `missingComponents`: the part categories a system type needs (`REQUIRED_COMPONENTS`) that the quote lacks. A Panel Set needs only panels, connectors and cable.
- **[warranty.ts](../src/lib/warranty.ts):**
  - `addMonths`: 31 Jan + 1 month gives 28/29 Feb, not 3 Mar.
  - ★ `getWarrantyInfo`: "In warranty · 1 yr 4 mo left" or "Expired …". Covered while now ≤ end, the same cut-off the ticket bill uses, so the card and the bill always agree.
  - ★ `workmanshipEnd`: commissioning date + the warranty months on the installation service line. Covers faults with no serial (wiring, earthing, structure).
  - `formatSpan`: the "1 yr 4 mo" text.
- **[costing.ts](../src/lib/costing.ts):**
  - ★ `costFromActuals`: revenue (excl. GST) − material (dispatched serials at their GRN cost, or the quote estimate until dispatch; bulk at cost) − labour (time logs × rate) − site extras − warranty repairs = profit and margin.
  - `isWarrantyCost`: tells a free repair's cost from a site extra.
- **[crew.ts](../src/lib/crew.ts):** ★ `chooseCrew`: from the preferred day, skip Sundays and find the first day (within 14) with three free installers, least-loaded first. If none, it takes the least-loaded crew on the preferred day and flags the double booking. `isSundayIST` checks the day in IST.
- **[analytics.ts](../src/lib/analytics.ts):**
  - `AnalyticsProps`: every event name mapped to its exact properties, so a typo or a stray property fails the type check. No names, phones, serials or search text.
  - ★ `scrubUrl`: share tokens become `:token`; only filters, tabs, pages and record ids survive in query strings.
  - ★ `maskContactText`: hides phone numbers, emails and GSTINs in session replay.
  - `scrubProperties`: runs `scrubUrl` over every string in an event, nested ones included (the page URL inside each web-vitals metric).
  - `scrubHeatmapData`: heatmap batches are keyed by page URL; the keys are scrubbed and merged.
  - `CTAS` and `cta(name)`: the 21 named calls to action (landing, header, footer, enquiry, warranty and the job page's WhatsApp button). `cta()` adds `data-ph-capture-attribute-cta`, the only label masked autocapture keeps, so clicks per CTA (and CTR) are measurable without element text.
- **[consent.ts](../src/lib/consent.ts)** (Hanvith):
  - ★ `consentStatus`: granted, denied or pending from the stored record. A choice lasts 12 months and one `CONSENT_VERSION`; with no choice, Global Privacy Control or Do Not Track mean denied.
  - `readConsent`, `saveConsent`, `onConsentChange` (this tab and others), `openConsentSettings`.
- **[dates.ts](../src/lib/dates.ts):**
  - `startOfDayIST`, `addDays`, `addHours`.
  - `getRange`: today, this week (from Monday) or this month, all in IST. `getPreviousRange` gives the period before.
  - `financialYear`: 31 Oct 2026 → "26-27".
- **[validation/](../src/lib/validation/):**
  - **Building blocks:** Indian mobile (10 digits starting 6–9), PIN code, GSTIN, rupees → paise.
  - **Leads:** e.g. `QualifyLeadSchema`, where the shadow-free area can't exceed the total roof area.
  - **Surveys:** e.g. `ReviewSurveySchema`, where a note is required unless approving.
  - **Quotes and payments:** e.g. `RecordPaymentSchema`, where a payment must link to an order or an invoice; `sendWithMissing` to confirm a quote with missing parts.
  - **Inventory:** `normalizeSerial`, `splitSerials` (pasted lists), `ReceiveGoodsSchema` (1–60 lines), dispatch and delivery schemas, stock correction and write-off with a reason.
  - **Jobs:** `RescheduleJobSchema` (1–6 technicians); `CompleteJobSchema` (installed size 0.5–10 kW, generation test ticked, 1–12 photos and a signature, missing items if the kit was incomplete, a note for any extra cost, refused while photos are still uploading).
  - **Service:** a serial or a customer to raise a ticket; replacement needs the new serial; billing override needs a reason; confirmation records who, how and when.
  - **Finance and warranty:** subsidy stages (application number for "applied", amount for "disbursed"), share link days (1–30), and the public lookup (serial, or phone + last 4).
- **[constants.ts](../src/lib/constants.ts):** every status, role and category with its label, badge colours (`STATUS_META`), company details, service labour rate and SLA hours, and analytics event names.

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
| `toCsv` ([csv.ts](../src/server/lib/csv.ts)) | RFC 4180 CSV with a UTF-8 BOM for Excel; text that would start a formula gets an apostrophe |
| `trackServer` | Sends a typed PostHog event after the response with `captureImmediate`, so it never slows the user; does nothing without a key |
| `captureServerError` | Reports an unhandled server error as `$exception` with the path scrubbed |

### Auth (Vamshi)

- **`authorized`** runs on every page request:
  - A signed-in user opening /login is sent to their home page.
  - Public pages (including `/warranty` and `/share/*`) are allowed.
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
| `getQuoteBuilderContext` | Catalog, a default package based on the survey's recommendation (a customer who asked for panels only gets the Panel Set), or an earlier quote to revise |
| ★ `checkComplete` | Sending a quote that lacks a needed part fails with the list ("earthing kit, lightning arrestor") unless `sendWithMissing` is set; the gap is then written on the timeline |
| ★ `saveQuote` | Re-reads every product from the database (the browser may only change quantities and unit prices), recomputes totals, numbers the next version and sets 15-day validity; lead → quoted |
| `listQuotes`, `getQuoteDetail` | List with search; detail including our internal margin |
| `markQuoteSent`, `rejectQuote` | Status changes; sending runs the same missing-parts check |
| ★ `acceptQuote` | Refuses expired quotes and declines the lead's other open quotes. Creates the order (awaiting payment) with a subsidy tracker if eligible; lead → won |

**Payments, orders and crew booking**

- **[payments.ts](../src/server/services/payments.ts) · ★ `recordPayment`:**
  - Refuses cancelled orders, ₹0 and overpayment, then records the payment.
  - On the first payment it confirms the order and builds the pick list from every non-service line.
  - If the order sells the installation service line, it books the installation through `pickCrew`; a hardware-only Panel Set gets no job.
  - Also: `listPayments`.
- **[core/crew.ts](../src/server/services/core/crew.ts) · ★ `pickCrew`:** loads active installers, their open-job load and who is busy on each day, then lets `chooseCrew` decide (see `src/lib/crew.ts`). Also: `busyTechnicianIds`.
- **[orders.ts](../src/server/services/orders.ts):**
  - `listOrders`.
  - `getOrderDetail`: the order with its customer, quote, job, crew, invoice and payments.
  - `cancelOrder`: refused once money has been received; otherwise returns reserved serials to stock and cancels the booked job.

**[inventory.ts](../src/server/services/inventory.ts)**

| Function | What it does |
|---|---|
| `listStock` | Per product: on hand (the ledger), reserved (on open pick lists), available, low-stock flag, and value at cost, with serialized units at their own goods-receipt cost |
| `listSerials` | Serial register with search, status filter and each unit's history |
| `listPurchases`, `getPurchase`, `listReceivableProducts` | Goods receipts, one receipt, and the products a receipt can include |
| ★ `receiveGoods` | Checks there is one serial per unit, no duplicates, no serial already registered, and no invoice date in the future. In one transaction it creates the receipt (SP-GRN-…), adds stock to the ledger, and registers each serial with its own cost and warranty months |
| `adjustStock` | A counted correction for bulk items (count short, connectors lost), through the ledger and never below zero |
| `writeOffSerial` | Takes a damaged or lost in-stock unit out: it becomes Faulty and leaves the ledger |

**[dispatch.ts](../src/server/services/dispatch.ts)**

| Function | What it does |
|---|---|
| `packingProgress`, `applyPackedStatus` | Counts scanned serials and ticked bulk lines; the order moves to Packed when complete and back to Confirmed if a unit is removed |
| `listDispatchQueue` | Three tabs: to pack (soonest installation first), in transit, delivered |
| `getDispatchDetail` | The packing bench data: lines, scanned serials, shelf stock, crew and invoice |
| ★ `scanSerial` | Allocates one unit to the order. It refuses an unknown serial, one already on this order, one packed for another order, one not in stock, the wrong product, or a line that is already full. It claims the unit atomically, so two people can't pack the same one |
| `unscanSerial`, `setBulkPicked` | Removes a unit (back to stock); ticks a bulk line, checking the shelf has enough |
| ★ `dispatchOrder` | Re-checks the pick list (`DISPATCH_INCOMPLETE` names what's missing), posts every line out of stock, marks serials Dispatched with the vehicle, and issues the GST tax invoice with serial numbers on the lines and payments so far applied |
| ★ `deliverOrder` | Starts each serial's warranty at the delivery date, for the months sold on the order. The timeline reads e.g. "6 panels to 31 Oct 2046 · 1 inverter to 31 Oct 2028". An order with no installation job (Panel Set) closes here |

**[jobs.ts](../src/server/services/jobs.ts)**

| Function | What it does |
|---|---|
| `getJobCalendar` | Seven days (the Monday–Sunday week, or seven days from today) with every technician, installations and service visits; flags a technician with two open jobs on one day |
| `getMyWork` | The technician's in-progress, today's and upcoming surveys, jobs and service visits, recently finished work and hours this month; flags "Kit not delivered yet" |
| `getJobDetail` | The job with its customer, order, crew, serials with warranty dates, the workmanship warranty, bulk items offered as extra material, and a feasibility warning for subsidy orders |
| `rescheduleJob` | Before start only; not in the past; active technicians only. A double booking or pending DISCOM feasibility still saves, with a warning |
| ★ `startJob` | Only the booked crew (or the director); an installation only after delivery; order → Installing |
| ★ `completeJob` | Photos must be finished uploads; only the crew may complete. The finish must be after the start, not in the future, and at most 16 hours later; a different installed size needs a reason. Extra material leaves stock and is added to the order's costs. It saves the checklist, kit check and signature, logs hours for each crew member (to the quarter hour), marks serials Installed and the order Commissioned |
| `assertCrew` | Only the booked crew may start or complete |

**[tickets.ts](../src/server/services/tickets.ts)**

| Function | What it does |
|---|---|
| ★ `decideWarranty` | From a serial: refuses unknown serials and units still in the warehouse; covered while now ≤ the unit's warranty end (not delivered yet = covered). Without a serial: the workmanship warranty of the customer's latest commissioned installation |
| `previewTicket` | What support sees before raising: the customer, their installed units and the decision |
| ★ `createTicket` | Refuses a serial that belongs to another customer. Numbers the ticket (SP-T-…), stores the warranty state and basis, sets billable when not covered and the SLA by priority; the timeline says "in warranty until … — free of charge" or "out of warranty since … — billed" |
| `assignTicket` | Books (or rebooks) a service visit, which appears on the crew calendar and My work |
| `startTicket` | The assigned technician starts the visit |
| `overrideBilling` | Support changes billability before resolution (e.g. physical damage), always with a reason |
| ★ `resolveTicket` | Parts leave stock at cost. A **replacement** must be the same product from stock; it takes over the faulty unit, inheriting the remaining cover when free or getting fresh cover when paid; the old unit becomes Replaced. Labour is billed at the service rate and costed at the technician's rate. **Billable:** the GST service invoice is issued at once. **Free:** what it cost us is added to the original order's extra costs as a warranty repair, so that installation's profit is lifetime profit. The visit is completed with a time log |
| ★ `confirmTicket` | Records who confirmed it works, how (call, WhatsApp or on site) and when; only then can it close |
| `closeTicket`, `reopenTicket` | Close after confirmation; "Not fixed" sends it back to In progress from resolved, confirmed or closed |
| `listTickets`, `getTicketDetail`, `exportTickets` | List with filters and age, detail with live warranty, CSV rows |

**Search, warranty and customers**

- **[search.ts](../src/server/services/search.ts) · ★ `searchRecords`:** two characters or more. Phone numbers match from 4 digits (with or without +91); serials match from 3 characters anywhere in the number, so the last digits on a label are enough. Up to 5 results per type, each type only for the roles that can act on it (`VISIBLE`). Serials carry their live warranty label; support's results go straight to raising a ticket.
- **[warranty.ts](../src/server/services/warranty.ts) · ★ `lookupWarranty`:** only units that reached a customer are found. By serial: that unit plus the installation's workmanship warranty. By phone: needs the last 4 characters of any serial on that roof as a second factor, then lists every unit. The answer masks the name ("L. N****, Kukatpally") and carries no phone or address; every miss returns the same "No match".
- **[customers.ts](../src/server/services/customers.ts):**
  - `upsertCustomerByPhone` reuses an existing record and fills in a missing email. `discomForCity` picks the electricity distributor (north Telangana → TSNPDCL, otherwise TSSPDCL).
  - `listCustomers`: search by name, city or phone digits.
  - ★ `getCustomer360`: enquiries and quotes, orders with what is paid and due, every serial with its warranty, the workmanship warranty, tickets, invoices, payments and the timeline.

**Costing and the dashboard**

- **[costing.ts](../src/server/services/costing.ts):** `costOrders` gathers actuals for many orders at once (GRN costs of dispatched serials, installation time logs with each technician's rate) and returns `costFromActuals` per order. `costOrder` does one.
- **[dashboard.ts](../src/server/services/dashboard.ts):**
  - `getPipeline(now)`: every open project by stage (Enquiry, Survey, Quote, Order, Dispatch, Installation) from current lead and order statuses, plus orders commissioned in the last 30 days; each stage links to its module.
  - ★ `getDashboard(range)`: for today, this week or this month (IST) against the period before. KPIs: revenue invoiced (excl. GST), cash collected, advances held on unfinished orders, stock purchased, technician hours, installs commissioned and their margin, new leads, open repairs. Plus a 12-month trend, the profit table, every customer waiting on a step, open repairs by age and subsidy files by stage.
  - ★ `getProfitTable`: profit per installation, losers first. With `masked` (share links) names become an initial and city.

**[finance.ts](../src/server/services/finance.ts)**

| Function | What it does |
|---|---|
| `listInvoices`, `getInvoiceDetail`, `exportInvoices` | Filters (open, overdue, type), the printable invoice, CSV rows |
| ★ `advanceSubsidy` | Residential on-grid orders only; stages in order (`SUBSIDY_FLOW`), dates never typed; "applied" needs the portal application number and "disbursed" the amount |
| `addSubsidyDocuments` | Keeps photographed subsidy papers on the order's file |
| `getSubsidyBoard` | Every subsidy file by stage |
| ★ `getPayroll(month)` | Every time log in the IST month (installations and service visits) × each technician's hourly rate |
| ★ `createShareLink`, `revokeShareLink` | An unguessable 24-byte token for the director's numbers, valid 1–30 days, revocable |
| ★ `certificateLink`, `activeCertificateLink` | A 90-day link to one installation's certificate for the customer; reuses the job's active link so the customer never gets two |
| ★ `openShareLink` | Checks the token's shape, then unknown, revoked or expired; counts the view |
| `shareLinkAllowsFile`, `listShareLinks` | Signed-out photo access only for the certified job's own photos; the director's list of links |

**Other services**

- **Catalog and staff:** `getActiveCatalog`, `listPackagesWithPricing`, `listProducts` (stock, reserved, low-stock flag, margin %), `listStaff`.
- **Timelines:** `logActivity`, `listActivity`, `listCustomerActivity`.
- **Numbering:** `nextSequence` (atomic increment), `nextNumber` (SP-L-0001), `nextInvoiceNumber` (INV/26-27/0001, restarts every April).
- **★ `moveStock`:** changes stock atomically, never below zero, and writes the ledger. Used by goods receipts, dispatch, extra material on site, service parts and stock corrections.
- **★ `issueInvoice`:** CGST and SGST, or IGST depending on the customer's state. Sale invoices at dispatch (due in 15 days); service invoices when a billable ticket is resolved (due in 7 days).
- **Media** ([core/files.ts](../src/server/services/core/files.ts)):
  - `saveSmallFile`: files up to 4 MB in one request.
  - `createUpload` → `writePiece` × n → `completeUpload` / `abortUpload`: big files in ~4 MB pieces; safe to retry.
  - `sniffType`: checks the bytes actually match the declared type.
  - `openFileStream`: streams with seeking. Also `deleteFile`.
  - `cleanupStaleUploads`: removes uploads abandoned for 6 hours.

### Actions (Vamshi)

Every action follows the same pattern: `runAction(roles)` → `parseForm(schema)` → service → `revalidatePath` (refresh the affected pages) → `trackServer`. The director passes every role check; `[]` means the director only.

| File | Actions (who may call them) |
|---|---|
| [leads.ts](../src/server/actions/leads.ts) | `createLeadAction`, `markContactedAction`, `markLeadLostAction` (sales, support); `qualifyLeadAction`, `reopenLeadAction`, `assignLeadAction`, `scheduleSurveyAction` (sales) |
| [surveys.ts](../src/server/actions/surveys.ts) | `submitSurveyAction` (technician; waits until photos finish uploading), `reviewSurveyAction` (sales) |
| [quotes.ts](../src/server/actions/quotes.ts) | `saveQuoteAction` (JSON from the builder), `markQuoteSentAction`, `acceptQuoteAction` (then opens the new order), `rejectQuoteAction` (all sales) |
| [orders.ts](../src/server/actions/orders.ts) | `recordPaymentAction` (sales, support; the payment date can't be in the future), `cancelOrderAction` (director only) |
| [inventory.ts](../src/server/actions/inventory.ts) | `receiveGoodsAction` (JSON from the receipt form), `scanSerialAction`, `unscanSerialAction`, `bulkPickAction`, `dispatchOrderAction`, `deliverOrderAction` (all warehouse); `adjustStockAction`, `writeOffSerialAction` (director) |
| [jobs.ts](../src/server/actions/jobs.ts) | `rescheduleJobAction` (sales), `startJobAction`, `completeJobAction` (technician), `certificateLinkAction` (sales, technician, support) |
| [service.ts](../src/server/actions/service.ts) | `createTicketAction`, `assignTicketAction`, `overrideBillingAction`, `confirmTicketAction`, `closeTicketAction` (support); `startTicketAction`, `resolveTicketAction`, `reopenTicketAction` (support, technician) |
| [finance.ts](../src/server/actions/finance.ts) | `advanceSubsidyAction`, `addSubsidyDocumentAction` (sales); `createShareLinkAction`, `revokeShareLinkAction` (director) |
| [public.ts](../src/server/actions/public.ts) | `submitEnquiryAction` (no login; 5 per 10 minutes per IP; a hidden spam-trap field gets a fake success), `lookupWarrantyAction` (no login) |

### UI (Hanvith)

**Pages.** Every page follows the same pattern: `requireUser(roles)` → read the URL filters → call services in parallel → render. For example, `LeadsPage` shows the board or the table (`?view=table`) and supports `?mine=1`, `?status=` and `?q=`. `JobsPage` shows each technician only their own row. `DashboardPage` reads `?range=today|week|month`; `/share/[token]` renders the same `DashboardView` masked, or the `CertificateView` for a certificate link.

| Component | Key functions |
|---|---|
| QuoteBuilder | `choosePackage` fills the full parts list; `updateLine` and `addLine` edit it; totals update live through `quoteTotals`; missing parts show as a warning with a "send anyway" confirmation; `save(send)` calls `saveQuoteAction` and opens the saved quote |
| PackingBench | Scan with the camera (`BarcodeScanner`) or type a serial → `scanSerialAction`; a large banner shows the server's reason for any refusal; tick bulk lines; records whether each serial was scanned or typed |
| GrnForm | One line per product, quantity and unit cost. Serials are scanned off the boxes, typed, or pasted (`splitSerials`); the counter turns green when the serials match the quantity. Posts JSON to `receiveGoodsAction` |
| CompleteJobForm | Times, installed size (with a reason if different), generation test, checklist, kit check, extra material, photos (`MediaUploader`) and the customer's signature (`SignaturePad`). **Local draft:** everything except the signature is saved to `localStorage` every 4 seconds under `sunpower:job-draft:<jobId>`, restored on reload ("Restored what you entered at …") and cleared on completion |
| CertificateView | One certificate for staff print and the customer link: serials with warranty end dates, workmanship warranty, crew, photos, signature; "Send on WhatsApp" card on the job page |
| WarrantyCard / ticket forms | The warranty decision shown before a ticket is raised; one form per ticket state (assign, start, override, resolve with parts or replacement, confirm, close, reopen) |
| LifecyclePipeline | The dashboard's forest strip: seven numbered stages with live counts, a lime dot where work waits, each linking to its module |
| EnergyFlow | Landing hero: On-Grid / Off-Grid × Sunny afternoon / Evening / Power cut. SVG wires (animated where power flows, with arrows) under HTML buttons for each part; a click explains the part; no invented figures |
| PageTransition | Wraps the app and public content (background tabs are skipped by `src/lib/view-transition-guard.ts`, installed in `instrumentation-client.ts`) in React's `<ViewTransition>` keyed by the pathname, so every navigation crossfades and lifts in |
| ScrollColumn | A board column that shows five cards and scrolls the rest (leads board, subsidy board, My work) |
| CountUp | Landing facts count up once when they scroll into view; the subsidy cap comes from `SUBSIDY_RULES` |
| PackageDialog | A catalog package card that opens its price breakdown and full bill of materials (`expandPackage` + `quoteTotals`) |
| SubsidyEstimator | Landing: size, home or business, On-Grid or Off-Grid → `estimateSubsidyRs` (the quote builder's rule) with the reason when not eligible; links to `/enquiry?kw=&type=` |
| DashboardView | KPI cards against the previous period, `RevenueTrendChart` (invoiced vs cash, 12 months), profit table with losers first and their cause, unfinished steps, repairs, subsidy; `SharePanel` creates, copies and revokes links |
| Subsidy dialogs | `SubsidyAdvanceDialog` moves to the next stage with its required detail; `SubsidyDocumentDialog` photographs papers onto the file |
| WarrantyLookup | Public form: serial, or phone + last 4; one "No match found" for every miss |
| RescheduleJobDialog | Marks technicians already booked that day; saving still works, and the toast names the double booking |
| WorkCard | One agenda item: when, where (maps link), who to call, and what's blocking it; addresses are hidden from session replay |
| MediaUploader | `classifyFile`; `compressImage` (1600 px, JPEG 80%, keeps photo orientation); `uploadDirect` or `uploadChunked`; `withRetries` (3 tries); 2 uploads at a time; blocks submit until uploads finish |
| ActionForm / ActionButton | `useActionFormState`, `toastActionResult`, `useFieldError`: the server's message becomes a toast, and errors show under each field |
| CommandPalette | ⌘K / Ctrl+K: quick actions and pages for the user's role, plus record search through `/api/v1/search`; tracks result counts and the type opened (never the search text) |
| AppShell / AccountMenu | Identifies the signed-in staff member to PostHog (id and role only) and resets on sign-out. The user shows once, at the foot of the sidebar: the card opens the account menu (My home, Warranty check, Public website, Cookie settings, Sign out) |
| ConsentBanner | Bottom card on every page while no choice is made: equal *Reject analytics* / *Accept analytics*, link to `/privacy`; reopened by `CookieSettingsButton` with the current state. Renders nothing on the server or without an analytics key |
| SidebarNav / MobileNav | Forest sidebar: `navForRole` filters the menu, `activeNavItem` marks the current page in amber; collapses to icons with labels in tooltips (remembered as `sunpower:sidebar`). The top bar shows "Section / Page" and a New menu from `QUICK_ACTIONS` |
| LoginForm | Demo-account shortcuts; only internal `callbackUrl` redirects |

**Helper files:**

- [format.ts](../src/lib/format.ts): IST dates, phone formatting, WhatsApp and call links, kW display.
- [navigation.ts](../src/lib/navigation.ts): `NAV_SECTIONS` in lifecycle order (Overview, Customer acquisition, Sales, Operations, After-sales, Business) with a `hint` per item; `QUICK_ACTIONS` shared by the top bar's New menu and ⌘K; `activeNavItem` (longest match, so `/inventory/serials` highlights Serial register); `canAccess` (the director can open everything), `navForRole`, `roleHome`.
- [query.ts](../src/lib/query.ts): `hrefWith` changes one URL parameter and keeps the rest.
- [analytics-client.ts](../src/lib/analytics-client.ts): ★ `startAnalytics` (the whole PostHog configuration, run only after consent: `/ingest` proxy, masked autocapture, heatmaps, rage/dead clicks, web vitals, replay masking, `before_send` scrubbing) and ★ `stopAnalytics` (opt out, forget the identity, delete every `ph_…` cookie and storage item); `track` for the two browser events; `identifyStaff` (remembered, so a later Accept still identifies and starts replay); `resetAnalytics`; `captureClientError` for error boundaries.

### Scripts and tests (Vamshi)

- **`seed.ts`:**
  - `main` refuses a remote database without `--yes`, upserts the staff and prints the demo logins.
  - `seedCatalog` bulk-upserts products, packages and opening stock.
  - `seedPurchases` receives the goods receipts through the real `receiveGoods` service, skipping any supplier invoice already on file.
  - `seedHistory` and `seedPipeline` run once each (marker records `seed:history`, `seed:pipeline`); a later run only adds what is new, such as the Panel Set customers.
- **Seed data helpers:**
  - `bom(kw, type)` is the package parts formula. Panels = ⌈kW × 1000 ÷ 545⌉, and on-grid systems add a net meter.
  - `grnSerials` makes repeatable serials like `WAA545-2609-0001`.
  - History is written straight into the collections with real dates and stays consistent with what the services would write: serial costs from their GRN, a ledger entry for every unit, the same GST maths, and a visible cause on every loss-maker (extra cable, crane hire, overtime, a warranty repair).
  - The pipeline goes through the real services, so open items behave exactly like ones made in the app. The brief's 18-month inverter is left without a ticket for the live demo.
- **Shared flow helper:** `makeConfirmedOrder` builds an order from a fresh enquiry, using the same services the screens call.
- **Flow checks:** each `main` runs a whole flow against a real database. `expectError` confirms illegal moves are refused, for example:
  - "can't accept twice", "overpayment rejected", "sending without earthing needs a confirmation";
  - "wrong product refused", "dispatch blocked before packing";
  - "start blocked until the kit is delivered";
  - "resolved isn't closed: confirmation comes first", "no certificate before the job is completed".
- **Unit tests:** they cover the pure rules directly (quote maths and GST, every state machine, warranty dates and the expiry cut-off, costing and crew choice, analytics scrubbing and masking), and feed the form schemas exactly what the browser posts, so a renamed field or a checkbox quirk fails in CI rather than on a roof.

## 5. Who built what

Numbers are from `git blame` (who wrote each line in the code today) and `git shortlog`, at `ba6fbab`. A file counts for whoever wrote most of its lines.

| | Hanvith Sai Alla | Lagishetty Vamshi |
|---|---|---|
| Role | Product, architecture, frontend | Backend, database, integration, tests |
| Code | 178 files · 16,624 lines | 121 files · 15,014 lines |
| Commits (incl. merges) | 120 (108 as Hanvith Sai Alla, 12 as `hanvithSai`, the GitHub and second-device identity) | 137 |
| Code owned | All pages and components, design system, formatting and navigation helpers, browser analytics, project config | Models, services, actions, auth, API routes, business rules in `src/lib`, server analytics, seed and checks, tests, CI, Vercel config |
| Docs | Plan, README, handoff log, all six product docs, Architecture, Engineering, this file, most of Setup | API.md, DB.md, parts of Setup and Human_Tasks |

**Branches.** 39 feature branches, each merged into `main` with a merge commit:

| Written by | Merged by | Branches |
|---|---|---|
| Hanvith | Vamshi | `chore/project-setup`, `docs/product-plan`, `feat/ui-shell`, `feat/quotes-ui` |
| Vamshi | Hanvith | `feat/db-core`, `feat/auth`, `chore/ci`, `feat/seed-users`, `feat/leads-api`, `feat/catalog-quotes-api`, `test/core` |
| Both | Hanvith | `feat/domain-lib`, `chore/deployment-config`, `feat/media-pipeline`, `chore/mumbai-region-health`, `feat/jobs-ui`, `feat/service-ui`, `feat/warranty-lookup`, `feat/customers`, `feat/panel-sets`, `feat/quote-checks`, `feat/certificate-link`, `feat/finance-extras`, `feat/stock-adjust`, `docs/phase-0-3-complete`, `feat/analytics` |
| Both | Vamshi | `docs/engineering`, `feat/leads-ui`, `docs/phase-1-sync`, `docs/codebase-guide` |
| Hanvith | Hanvith | `docs/brief-audit`, `feat/dispatch-ui`, `feat/dashboard-ui`, `feat/ui-polish` |
| Vamshi | Vamshi | `feat/inventory-api`, `feat/jobs-api`, `feat/service-api`, `feat/finance-api`, `feat/seed` |
