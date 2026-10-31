# SunPower OS: Feature Specifications

| | |
|---|---|
| **Version** | 1.0, 31 Oct 2026 |
| **Owner** | Hanvith Sai Alla (product) · reviewed by Lagishetty Vamshi (backend) |
| **Related** | [PRD.md](PRD.md) (lifecycle, business rules BR-xx, user stories) · [Analytics.md](Analytics.md) (events) · [Style_Guide.md](Style_Guide.md) (UI) |

Each feature lists its purpose, screens, key fields, actions, validations, automations, role access and priority. Business rules (BR-01 to BR-17) are defined in PRD section 8.

## Conventions

- **Roles:** `admin` (director), `sales`, `technician`, `warehouse`, `support`. The public needs no login.
- **Document numbers:** from atomic counters. SP-L lead, SP-SV survey, SP-Q quote, SP-O order, SP-PAY payment, SP-GRN goods received note, SP-J job, SP-T ticket (four-digit sequences, e.g. SP-L-0231); GST invoices restart every financial year (INV/26-27/0001).
- **Money:** integer paise in the database; ₹ with lakh grouping in the UI (₹1,50,000).
- **Time:** stored in UTC, shown in IST as DD MMM YYYY.
- **Validation:** one Zod schema per form, run in the browser and again on the server. Enum values below mirror the Zod enums in `src/lib/schemas`.

## Delivery status (31 Oct 2026)

Live at https://www.sunpowersolutions.me. Where this spec and the code differ, `src/lib/constants.ts` and `src/lib/workflows.ts` are the source of truth; specs for features not built yet are reconciled with the code as each one ships.

| Feature | Status | Notes |
|---|---|---|
| F01 Sign-in and roles | ✅ Shipped | Auth.js v5; role landing pages; proxy + per-page + per-action checks |
| F02 App shell and ⌘K | ✅ Shipped | ⌘K page navigation, quick actions and record search (customers, leads, quotes, orders, serials with warranty badge, tickets, invoices) |
| F03 Public enquiry form | ✅ Shipped | `/enquiry` + `POST /api/v1/enquiries`; rate limit, honeypot, dedupe |
| F04 Lead pipeline | ✅ Shipped | Board and table, SLA badges, auto-assignment, timeline |
| F05 Qualification checklist | ✅ Shipped | Live "fits about N kW" hint (≈100 sq ft per kW) |
| F06 Site survey | ✅ Shipped | Mobile form, compass picker, camera uploads to GridFS; approve / re-survey / not feasible |
| F07 Catalog and packages | 🟨 Partly | Seeded catalog (30 products, 10 packages) shown read-only; create/edit UI pending |
| F08 Quote builder | ✅ Shipped | Package → full BOM, live GST/subsidy/margin, server re-pricing, print + WhatsApp |
| F09 Orders and payments | ✅ Shipped | First payment confirms the order → pick list + installation job (least-loaded crew) |
| F19 Activity timeline | 🟨 Partly | Timelines on leads, quotes and orders; customer-wide timeline with F13 |
| F10 Inventory, serials and purchases | ✅ Shipped | Stock (on hand, reserved, available, value at GRN cost), serial register, GRN with serials by camera, typing or paste; stock adjustment UI pending |
| F11 Dispatch and serial scanning | ✅ Shipped | Packing bench (camera + manual), wrong-product / already-packed / not-in-stock refusals, auto "Packed", dispatch gate (BR-02), sale invoice at dispatch (BR-18), delivery starts warranties (BR-03) |
| F12 Installation jobs | ✅ Shipped | Auto-crew free that day (BR-07), My work, crew calendar, Start gate, completion with times, kW, generation test, kit check, extras, photos, signature (BR-14), time logs, certificate |
| F13 Service desk, search and warranty | ✅ Shipped | Warranty per serial + 5-year workmanship warranty for no-serial faults (BR-04); visit on the technician's calendar; ₹0 in warranty with the cost charged to the order; auto service invoice out of warranty; same-product replacements inherit cover (BR-15); billing override with reason; close only after the customer confirms (BR-06) |
| F14 Invoices and job costing | ✅ Shipped | Sale invoice at dispatch (BR-18), service invoices from tickets, printable GST invoice with amount in words; costing from actuals (GRN cost per serial, crew hours × rate, site extras, warranty repairs) on every order |
| F15 Director dashboard | ✅ Shipped | Today / week / month KPIs incl. advances held, stock purchased and hours; validated 12-month chart; profit per job worst first with cost drivers; unfinished steps per customer; open repairs by age; subsidy pipeline |
| F16 Subsidy tracker | ✅ P0-lite | Stage stepper on the order and `/subsidy` board (application number and amount required at the right stages); document uploads still P1 |
| F17 Share link and CSV | ✅ P0-lite + revoke | Expiring read-only `/share/[token]` with names masked, revoke, view count; profit CSV (also via the token) and payroll CSV |
| F18 Technician hours and payouts | ✅ P0-lite | `/team` monthly hours (installation and service) × rate with CSV; editing logs and closing a month still P1 |
| F20, F22, F23 | 🗓️ Planned | Public warranty lookup and the customer certificate link are Phase 3b; offline drafts P2. F21 cut after the 31 Oct brief audit (Plan.md section 1b) |

## Route access

Legend: **F** full · **A** assigned records only · **V** view only · **—** no access (hidden from navigation and refused by the server).

| Staff route | admin | sales | technician | warehouse | support |
|---|---|---|---|---|---|
| `/dashboard` | F | — | — | — | — |
| `/my-work` | V | — | A | — | — |
| `/leads`, `/leads/[id]` | F | F | — | — | V |
| `/surveys`, `/surveys/[id]` | F | F | A | — | — |
| `/catalog` | F | V | — | V | V |
| `/quotes`, `/quotes/new`, `/quotes/[id]` | F | F | — | — | V |
| `/orders`, `/orders/[id]` | F | F | — | V | V |
| `/inventory`, `/inventory/serials`, `/inventory/purchases` | F | V | — | F | V |
| `/dispatch`, `/dispatch/[orderId]` | F | V | — | F | — |
| `/jobs`, `/jobs/[id]` | F | F | A | V | V |
| `/service`, `/service/new`, `/service/[id]` | F | V | A (no `/service/new`) | — | F |
| `/invoices`, `/invoices/[id]` | F | F | — | — | V |
| `/subsidy` | F | F | — | — | V |
| `/team` | F | — | — | — | — |

Public routes need no login: `/` landing and `/enquiry` form (F03, rate-limited), `/warranty` lookup (F20, rate-limited, masked output), `/share/[token]` read-only views (F17, F22, expiring) and `/login` (F01).

Home after sign-in: admin `/dashboard`, sales `/leads`, technician `/my-work`, warehouse `/dispatch`, support `/service`.

## P0: Must have

### F01 Sign-in and role-based access (P0)

- **Purpose:** keep internal screens private and show each role only its own work.
- **Screens:** `/login`; user management in `/team`.
- **Key fields:** name, email, mobile, role, active, hourly rate (technicians), password hash.
- **Actions:** sign in, sign out; admin creates, edits and deactivates users and sets a temporary password.
- **Validations:** valid email; password at least 8 characters; one generic error for any failure; 5 failed attempts in 15 minutes lock that email for 15 minutes; inactive users refused.
- **Automations:** signed JWT (`jose`) in an httpOnly, Secure, SameSite=Lax cookie valid for 7 days; `proxy.ts` sends signed-out users to `/login?next=…` and keeps each role inside its routes; every server action and API route checks the role again.
- **Access:** all staff sign in; admin manages users.

### F02 App shell, navigation and command palette (P0)

- **Purpose:** one consistent workspace: any screen in one click, any record in two keystrokes.
- **Screens:** every staff route (sidebar, top bar, ⌘K palette, toasts).
- **Key elements:** sidebar groups: Overview (Dashboard, My work), Sales (Leads, Surveys, Quotes, Orders), Operations (Inventory, Dispatch, Jobs), Service, Finance (Invoices, Subsidy), Settings (Catalog, Team); top bar with search, user menu and role; breadcrumbs on detail pages.
- **Actions:** open search (⌘K or Ctrl+K), navigate, sign out.
- **Validations:** navigation filtered by role (items hidden, not just disabled); unknown routes show a friendly 404.
- **States:** loading skeletons, empty states with the next action, error states with Retry, a toast for every mutation, business-rule errors in plain language.
- **Access:** all staff; items vary by role (see Route access).

### F03 Public enquiry form (P0)

- **Purpose:** every web enquiry lands in the pipeline without anyone re-typing it.
- **Screens:** `/` (hero, 1–5 kW packages, subsidy explainer, "Get a free quote"), `/enquiry` (form and confirmation).
- **Key fields:** name, mobile, email (optional), address, area or city, pincode, customer type (`home`, `business`), system type (`on_grid`, `off_grid`, `not_sure`), capacity (1–5 kW or not sure), monthly bill (₹), subsidy interest, preferred call time, consent.
- **Actions:** submit; or WhatsApp the company through a `wa.me` link.
- **Validations:** name 2–80 characters; mobile `^[6-9]\d{9}$` after removing +91, a leading 0 and spaces; pincode `^[1-9]\d{5}$`; bill ₹0–₹10,00,000; consent required; hidden honeypot field; 5 submissions per IP per hour.
- **Automations:** creates or reuses the customer and creates a lead with source `website` (or a `?source=` campaign value such as `whatsapp` or `qr`); an open lead with the same mobile gets an activity instead of a duplicate (BR-10); the first-response clock starts; events `enquiry_submitted`, `lead_created`.
- **Access:** public.

### F04 Lead pipeline (P0)

- **Purpose:** one place for every lead from every channel, with nobody left waiting.
- **Screens:** `/leads` (kanban and table), `/leads/[id]` (customer, qualification, survey, quotes, timeline).
- **Key fields:** lead number (SP-L-0231), customer, source (`website`, `whatsapp`, `phone`, `walk_in`, `referral`, `other`), status, owner, requested kW, system type, subsidy interest, created at, first contacted at, close reason.
- **Statuses:** `new` → `contacted` → `qualified` → `survey_scheduled` → `survey_completed` → `survey_approved` → `quoted` → `won`; `lost` (with a reason) closes the lead at any stage; sales can reopen a lost lead.
- **Actions:** add a lead (source required), assign owner, Call (`tel:`), WhatsApp (`wa.me/91XXXXXXXXXX?text=…`), log a call or note, change status, reject or mark lost.
- **Validations:** state-machine transitions only, enforced on the server; reason required to close; no delete.
- **Automations:** Call and WhatsApp are one-tap deep links (the WhatsApp message is prefilled), and "Mark contacted" stamps first contacted at and moves New to Contacted; a repeat enquiry from the same phone within 30 days attaches to the open lead; website leads are auto-assigned to the salesperson with the fewest open leads; SLA badge amber at 1 h and red at 2 h, red leads first (BR-11); the pipeline refreshes after every action; Won is set when an order is created; event `lead_status_changed`.
- **Access:** admin and sales full; support view.

### F05 Qualification checklist (P0)

- **Purpose:** decide on the first call whether the roof is worth a technician's visit.
- **Screens:** Qualification panel on `/leads/[id]`.
- **Key fields:** shadow-free roof area (sq ft), roof type (RCC flat, metal sheet, tiled), storeys, monthly bill (₹), sanctioned load (kW), phase (single, three), DISCOM (TSSPDCL, TSNPDCL), service connection (USC) number, grid connection suitable, notes.
- **Actions:** save, Qualify, Reject.
- **Validations:** every item required to Qualify; area > 0; suggested capacity = area ÷ 100 sq ft rounded down, at most 5 kW; warnings when the requested kW exceeds the suggestion or the sanctioned load; rejection reason from a fixed list (shaded roof, too little area, grid not suitable, budget, not interested, outside service area, duplicate).
- **Automations:** Qualify moves the lead to Qualified and offers "Schedule survey"; event `lead_status_changed`.
- **Access:** admin, sales.

### F06 Site survey (P0)

- **Purpose:** measure the roof on site and approve the result before any quote (BR-01).
- **Screens:** `/surveys` (by status, date and technician), `/surveys/[id]` (mobile form for the technician, review panel for sales), `/my-work`.
- **Key fields:** survey number, lead, technician, date and slot (morning, afternoon), roof direction (N, NE, E, SE, S, SW, W, NW), tilt (°), usable shadow-free area (sq ft), cable distance panels → inverter and inverter → distribution board (m), shading (none, partial, heavy) with notes, structure (flush, elevated), earthing pit location, photos, recommended kW, review note.
- **Statuses:** `scheduled` → `submitted` → `approved` or `rejected` (revisit, or close as not viable).
- **Actions:** schedule or reassign (sales), fill and submit (technician), approve or reject with a reason (sales, admin).
- **Validations:** active technician; date not in the past; tilt 0–60°; distances 0–200 m; recommended kW 1–5; at least 2 photos; reason required to reject.
- **Automations:** the assignment appears in the technician's My work; photos compressed on the device to about 200 KB; approval unlocks "Create quote"; events `survey_scheduled`, `survey_completed`, `survey_reviewed`.
- **Access:** admin and sales full; technician assigned surveys only.

### F07 Catalog and package templates (P0)

- **Purpose:** one price list and one bill of materials (BOM) per package, so no quote is typed and no part is forgotten.
- **Screens:** `/catalog` with Products and Packages tabs.
- **Key fields:** product: SKU, name, brand, category (panel, inverter, battery, charge controller, ACDB, DCDB, structure, cable, connector, earthing, lightning arrestor, service), unit (pcs, m, set), serialized, cost price, sell price, HSN/SAC, GST rate, warranty months, reorder level, active. Package: code (for example `ONGRID-3KW`), name, type (panel set, On-Grid, Off-Grid), capacity (1–5 kW), BOM lines (product, quantity), active.
- **Actions:** create, edit, duplicate (for example 3 kW → 4 kW), deactivate.
- **Validations:** unique SKU; prices ≥ 0; warning when sell price is below cost; GST rate must be a current slab (0, 5, 18 or 40%); serialized products need warranty months > 0; system packages need panels, an inverter, a structure and earthing, and Off-Grid also needs a battery; warning when total panel Wp is below the package kW; products in use are deactivated, never deleted.
- **Automations:** none on save; quotes copy prices when created (BR-09).
- **Seed:** panels (Waaree, Adani, Tata Power Solar, 540–550 Wp), inverters (Growatt, Sungrow, Luminous, Havells), batteries (Exide, Luminous), charge controllers, ACDB/DCDB, earthing kits, GI structures, DC and AC cable, MC4 connectors, lightning arrestors; 10 system templates (1–5 kW × On-Grid and Off-Grid) and a hardware-only panel set (panels, connectors, cable). Defaults: warranty 24 months for inverters, batteries and charge controllers, 240 for panels; GST 5% equipment, 18% batteries, 18% installation.
- **Access:** admin full; sales, warehouse and support view.

### F08 Quote builder (P0)

- **Purpose:** a complete, correctly taxed quote from a template in about a minute.
- **Screens:** `/quotes` (number, customer, kW, total, status, version, valid until), `/quotes/new?leadId=…` (builder), `/quotes/[id]` (detail, versions, print view).
- **Key fields:** quote number (SP-Q-0142) and version, lead, customer type, package, lines (product, description, HSN/SAC, quantity, unit price, GST %, taxable value, CGST, SGST, total), discount, subtotal, GST, grand total, subsidy eligibility, expected subsidy, effective cost, estimated margin (never printed), valid until, terms.
- **Statuses:** `draft` → `sent` → `accepted`, `declined` or `expired`; older versions become `superseded`.
- **Actions:** choose a package (fills the BOM and installation line), edit lines, save, print or save as PDF, mark sent, share through `wa.me`, create a new version, accept, decline with a reason.
- **Validations:** survey gate (BR-01: button disabled with the reason; server error `SURVEY_NOT_APPROVED`); at least one line; quantity > 0; price ≥ 0; discount ≤ subtotal; warning when a system quote lacks panels, inverter, structure or earthing; sent quotes are read-only.
- **Automations:** GST per line split into CGST and SGST; subsidy for residential On-Grid quotes (PRD 9.3); margin warning below 15%; expiry after 15 days; lead moves to Quoted when sent and Won when accepted; events `quote_created`, `quote_sent`, `quote_accepted`.
- **Access:** admin and sales full; support view.

### F09 Orders and payments (P0)

- **Purpose:** one acceptance and one payment start the warehouse and the crew, with no phone calls.
- **Screens:** `/orders` (number, customer, kW, total, paid, balance, stage), `/orders/[id]` (summary, payments, pick list, job, invoices, subsidy, costing, timeline).
- **Key fields:** order number (SP-O-0099), accepted quote version, customer, locked lines, total, paid, balance, stage. Payment: type (`advance`, `balance`, `full`), mode (`upi`, `bank_transfer` (NEFT, RTGS, IMPS), `cash`, `cheque`, `card`), amount, date, reference (UTR or cheque number), received by.
- **Statuses:** `pending_payment` → `confirmed` → `ready_to_dispatch` (packed) → `dispatched` → `delivered` → `installing` → `commissioned` → `closed`; `cancelled` (admin, before dispatch and before any payment, with a reason).
- **Actions:** accept a quote (creates the order), record a payment, print a receipt, issue an invoice (F14), cancel.
- **Validations:** BR-08 (amount > 0 and ≤ balance; date not in the future; reference except for cash); type `full` only when it clears the balance.
- **Automations:** the first payment confirms the order and creates the pick list and an installation job about four days out with three installers free that day, in one transaction (BR-07); eligible orders get a subsidy record (F16); events `payment_recorded`, `order_confirmed`.
- **Access:** admin and sales full; warehouse and support view.

### F10 Inventory, serials and purchases (P0)

- **Purpose:** know what is in stock and where every serialized unit is.
- **Screens:** `/inventory` (stock by product), `/inventory/serials` (serial register), `/inventory/purchases` (GRN list and new GRN).
- **Key fields:** stock move (product, quantity ±, type: GRN, dispatch, return, adjustment; reference; reason). Serial unit (serial number, product, status `in_stock`, `dispatched`, `installed`, `replaced`, `rma`; GRN; order; customer; warranty). GRN (SP-GRN-0045, supplier, supplier invoice number, date, lines with quantity, unit cost and serials).
- **Actions:** receive goods, enter serials (scan, type or paste a list), adjust stock (admin, with a reason), view a serial's history.
- **Validations:** a serialized GRN line needs exactly one unique serial per unit; a serial is unique per product across the system; quantity > 0; unit cost ≥ 0; stock never negative (BR-13).
- **Automations:** a GRN posts stock moves and creates serial units In stock; available = on hand − reserved on open pick lists; low-stock badge at or below the reorder level; event `grn_received`.
- **Access:** admin and warehouse full; sales and support view.

### F11 Dispatch and serial scanning (P0)

- **Purpose:** nothing serialized leaves without being scanned, and delivery starts every warranty.
- **Screens:** `/dispatch` (pick lists: Open, Ready, Dispatched, Delivered), `/dispatch/[orderId]` (scanner and lines).
- **Key fields:** pick list (order; lines with required and scanned quantity; scanned serials; ticks for bulk lines), vehicle number, dispatched at, delivered at, received by.
- **Actions:** scan with the camera (`@zxing/browser`) or type a serial, remove a scan, tick bulk lines, Dispatch, Mark delivered.
- **Validations:** each scan must exist, be In stock, match an open line's product, not be scanned already (here or on another order) and not exceed the line quantity; messages name the problem, for example "SG3K-2026-4471 is a Sungrow 3 kW inverter; this order needs a Growatt 3 kW"; Dispatch enabled only when complete (BR-02); Delivered only after Dispatched.
- **Automations:** an accepted scan gives a green flash and a short vibration where supported; Dispatch marks serials Dispatched, posts stock moves and moves the order to Dispatched; Mark delivered creates the warranties (BR-03), moves the order to Delivered and enables the job's Start; events `serial_scanned`, `order_dispatched`, `order_delivered`.
- **Access:** admin and warehouse full; sales view.

### F12 Installation jobs (P0)

- **Purpose:** schedule the crew and capture proof of every installation from the roof.
- **Screens:** `/jobs` (week calendar by technician with a "To schedule" lane; list view), `/jobs/[id]` (detail, mobile completion form, certificate print view), `/my-work`.
- **Key fields:** job number (SP-J-0087), order, customer, address with a map link, date, lead technician, helpers, status, started at, finished at, confirmed kW, generation test passed, kit check (all items received, or which were missing), photos, signature image and signer name, installed serials, extras (extra cable in m, extra hours, other cost in ₹ with a note), time logs.
- **Statuses:** `scheduled` (booked automatically at confirmation) → `in_progress` → `completed`; `cancelled`.
- **Actions:** schedule or reassign (admin, sales), Start and Complete (technician), print the certificate.
- **Validations:** date today or later; warning when a technician is double-booked; Start only after the order is Delivered; finish after start; confirmed kW 0.5–10 with a reason if it differs from the order; at least 1 photo; signature not empty; generation test ticked (BR-14).
- **Automations:** Start moves the order to Installing; Complete marks serials Installed, moves the order to Commissioned, writes a time log for each crew member (F18), updates costing and creates the certificate; events `job_started`, `job_completed`.
- **Access:** admin and sales schedule; technician assigned jobs; warehouse and support view.

### F13 Service desk, search and warranty (P0)

- **Purpose:** find the customer and serial in seconds, apply the warranty rules, and track every complaint until the customer confirms the fix.
- **Screens:** ⌘K palette (all staff), `/service` (tickets by status, with age), `/service/new` (prefilled from a search result), `/service/[id]` (ticket, warranty card, parts, billing, timeline).
- **Key fields:** ticket number (SP-T-0310), customer, order, serial (optional), category (`no_power`, `fault_code`, `low_generation`, `physical_damage`, `battery`, `wiring_earthing`, `structure`, `billing`, `other`), fault code and description, priority (low, medium, high, urgent → SLA 72/48/24/4 h), technician, warranty state (`in_warranty`, `out_of_warranty`, `no_serial`) and basis (`serial`, `workmanship`, `none`), both set at creation, parts used, labour hours, resolution type (`repair`, `replacement`, `no_fault`, `advice`), billable, override reason, customer confirmation (who, channel, when), invoice.
- **Search:** mobile (full or last 4+ digits), name (partial, any case), serial (full or last 4+ characters) and document numbers; results grouped as Customers, Serials, Leads, Quotes, Orders, Tickets and Invoices; under 1 s.
- **Statuses:** `open` → `assigned` → `in_progress` → `resolved` → `customer_confirmed` → `closed`; "Not fixed" returns a Resolved ticket to In progress.
- **Actions:** create a ticket from a result, assign, start, add parts and hours, replace a serial, resolve, record the customer's confirmation, close.
- **Validations:** description required; a technician is required to assign; resolution type required; billable tickets need parts or hours; a replacement unit must be In stock and the same product; Close only from Customer confirmed (BR-06).
- **Automations:** warranty state from the serial's warranty (BR-04); ₹0 in warranty; out of warranty, Resolve creates the service invoice (BR-05); a replacement swaps the serials and applies BR-15; events `search_performed`, `search_result_opened`, `ticket_created`, `ticket_resolved`, `ticket_closed`.
- **Access:** admin and support full; technician assigned tickets; sales view.

### F14 Invoices and job costing (P0)

- **Purpose:** GST-correct invoices and a true profit figure for every job.
- **Screens:** `/invoices` (number, type, customer, amount, status, due date), `/invoices/[id]` (detail, payments, print view), costing card on `/orders/[id]`.
- **Key fields:** invoice number (sequential per financial year, at most 16 characters), type (`order`, `service`), date, due date; SunPower's legal name, address and GSTIN; customer name, address and GSTIN (business customers); place of supply (Telangana, 36); lines (description, HSN/SAC, quantity, unit, rate, taxable value, GST %, CGST, SGST); totals; amount in words; status.
- **Statuses:** `draft` → `issued` → `partly_paid` → `paid`; `overdue` after the due date.
- **Actions:** issue from an order (prefilled from the accepted quote), print or save as PDF, record a payment, export CSV.
- **Validations:** customer GSTIN must match the 15-character format when given; totals computed on the server; issued invoices are read-only (credit notes are out of scope).
- **Automations:** service invoices come from F13; status follows payments; costing = revenue excl. GST − material cost (cost price of dispatched units and service parts) − labour (hours × rate) − extras, giving profit and margin %; event `invoice_issued`.
- **Access:** admin and sales full; support view.

### F15 Director dashboard (P0)

- **Purpose:** answer "which jobs made money, which lost money, and what is unfinished?" on one screen.
- **Screens:** `/dashboard`.
- **Content:** period switch (Today, This week, This month; IST, weeks Monday to Sunday); KPI cards (revenue excl. GST, cash collected, new leads, installations commissioned, gross margin, open tickets); 12-month revenue trend; profit-per-job table (order, area, kW, revenue, cost, profit, margin); stuck projects (no stage change for 7 days or more, with stage and owner); open repairs by age; subsidy pipeline by stage.
- **Actions:** change the period, sort and filter the table, open any row, Share and Export (F17).
- **Validations:** every figure from live MongoDB aggregations, never static JSON; ₹ in lakh format, compact on cards (₹18.6 L).
- **Automations:** loss-making rows red; rows under 15% margin amber.
- **Access:** admin.

## P1: Should have

### F16 PM Surya Ghar subsidy tracker (P0-lite: stages, dates, dashboard counts · P1: documents, warnings)

- **Purpose:** no customer loses a subsidy to lost paperwork.
- **Screens:** `/subsidy` (board by stage), subsidy panel on `/orders/[id]`.
- **Key fields:** national portal application number, DISCOM, service connection number, capacity, expected subsidy, stage and stage dates, documents (feasibility letter, net-meter photo, inspection or commissioning report, disbursement reference), amount received, received on.
- **Stages:** Not applied → Applied → Feasibility approved → Net meter installed → Inspected → Subsidy disbursed.
- **Validations:** residential On-Grid orders only; stages advance in order and dates never go backwards; Disbursed needs an amount and a date.
- **Automations:** record created when an eligible order is confirmed; warning when installation is scheduled before feasibility approval; counts and ₹ by stage feed the dashboard.
- **Access:** admin and sales full; support view.

### F17 Share link and CSV export (P0-lite: expiring link + profit CSV · P1: revoke, other CSVs)

- **Purpose:** share the numbers with a partner or the accountant without creating a login.
- **Screens:** Share and Export on `/dashboard`; read-only `/share/[token]`.
- **Key fields:** share link (token hash, scope, period, created by, expires at, revoked at).
- **Actions:** create, copy and revoke a link; export CSV (profit per job, invoices, open tickets).
- **Validations:** signed, unguessable token checked against its stored record so it can be revoked; default expiry 7 days, maximum 30; expired or revoked links show a clear message; shared views leave out customer phone, email and address; pages are `noindex`.
- **Automations:** events `share_link_created`, `report_exported`.
- **Access:** admin.

### F18 Technician hours and payouts (P0-lite: monthly summary + CSV · P1: edit logs, close month)

- **Purpose:** pay technicians for the hours they worked, and feed those hours into job costing.
- **Screens:** `/team` (members, roles, hourly rates, monthly hours, payout summary); time logs on `/jobs/[id]`.
- **Key fields:** time log (technician; job, survey or ticket; start; end; hours; type: survey, installation, service, travel), hourly rate, month.
- **Actions:** add or correct a log (admin, lead technician), close a month, export CSV.
- **Validations:** end after start; no overlapping logs for one technician; more than 14 hours in a day needs an admin note.
- **Automations:** job completion creates logs for each crew member; payout = Σ hours × rate; logs feed costing (F14).
- **Access:** admin full; technicians see their own hours in `/my-work`.

### F19 Activity timeline and audit log (P1)

- **Purpose:** show who did what, and when, on every record.
- **Screens:** timeline panel on `/leads/[id]`, `/quotes/[id]`, `/orders/[id]`, `/jobs/[id]`, `/service/[id]` and `/invoices/[id]`.
- **Key fields:** entity, action (created, status changed, payment recorded, serial scanned, override), from, to, actor (user id and role), time, note.
- **Validations:** append-only; entries are never edited or deleted.
- **Automations:** services write the entry in the same transaction as the change.
- **Access:** anyone who can view the record.

### F20 Public warranty lookup (P1)

- **Purpose:** homeowners check their warranty without calling support.
- **Screens:** `/warranty`.
- **Key fields:** input is a serial number, or a mobile number plus the last 4 characters of any serial at that address; output is product, delivery date, warranty end and state, a masked customer ("L. N****, Kukatpally"), and call and WhatsApp buttons to raise a complaint.
- **Validations:** POST only, so no personal data appears in URLs; 10 lookups per IP per hour; the same "No match found" message for every failure.
- **Access:** public.

## P2: Could have

### F21 Email notifications (✂️ cut 31 Oct: no verified sender domain; wa.me links cover it)

- **Purpose:** tell people automatically instead of by phone.
- **Triggers:** new lead → its owner; quote sent → customer (with a link); ticket status change → customer.
- **Automations:** Resend free tier; sent after the change commits, using Next.js `after()`; a failed email never fails the action; customers can opt out.
- **Access:** system.

### F22 Customer project tracking link (P2)

- **Purpose:** customers see where their project stands, which cuts "what's the status?" calls.
- **Screens:** `/share/[token]` with project scope.
- **Content:** stage timeline (Enquiry → Commissioned), next step and date, quote, invoice and certificate, warranty list; no costs or margins.
- **Validations:** token expires after 90 days and can be revoked.
- **Automations:** link created when the order is confirmed and sent in a `wa.me` message.
- **Access:** public, link holders only.

### F23 Offline-tolerant technician forms (P2)

- **Purpose:** weak rooftop signal never loses a survey or job form.
- **Screens:** `/surveys/[id]` and `/jobs/[id]` on phones.
- **Behaviour:** drafts autosave to IndexedDB on every change; an offline banner (`navigator.onLine`, or Next.js 16's experimental `useOffline` hook); submissions queue until the phone is back online, with compressed photos; an idempotency key stops a retry from creating duplicates.
- **Validations:** the same Zod schema runs before queueing, and the server validates again.
- **Access:** technician.
