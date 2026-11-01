# API.md: HTTP endpoints and Server Actions

SunPower is a Next.js monolith. Staff screens call **Server Actions** (type-safe RPC over POST) for mutations and read data in **Server Components**. Public and integration traffic uses the versioned REST API under **`/api/v1`**.

Status legend: ✅ implemented · 🟨 in progress · 🗓️ planned (phase noted)

## Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` (breaking changes → `/api/v2`) |
| Format | JSON in and out (`Content-Type: application/json`), except file uploads/downloads and CSV exports |
| Auth | Session cookie set by Auth.js (`/api/auth/*`). Staff endpoints return **401** when signed out and **403** for the wrong role. Admins can call everything |
| Errors | `{ "error": { "code": "VALIDATION", "message": "Please fix the highlighted fields.", "fieldErrors": { "phone": "Enter a valid 10-digit Indian mobile number" } } }` |
| Status codes | 200 OK · 201 Created · 206 Partial Content (media ranges) · 400 BAD_REQUEST · 401 UNAUTHORIZED · 403 FORBIDDEN · 404 NOT_FOUND · 409 INVALID_STATE / CONFLICT / INSUFFICIENT_STOCK / DISPATCH_INCOMPLETE · 422 VALIDATION · 429 RATE_LIMITED · 500 INTERNAL |
| Money | integer **paise** in payloads (`amountPaise`). Forms accept rupees and convert |
| Dates | ISO-8601 UTC strings. UIs display in IST (Asia/Kolkata) |
| Rate limits | Public endpoints: per-IP fixed window (enquiries 5 / 10 min, warranty lookup 10 / hour) |
| Implementation | `apiHandler()` + `requireApiUser(roles)` in `src/server/lib/api.ts` give the same error shape everywhere |

## Authentication: Auth.js v5 ✅

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/csrf` | CSRF token for credential sign-in |
| POST | `/api/auth/callback/credentials` | Email + password sign-in (bcrypt check). Sets an httpOnly JWT session cookie (12 h) |
| GET | `/api/auth/session` | Current session `{ user: { id, name, email, role } }` |
| POST | `/api/auth/signout` | Sign out |

The UI uses the Server Actions `loginAction(prev, formData)` and `logoutAction()` (`src/server/actions/auth.ts`). After login each role lands on its home: director → `/dashboard`, sales → `/leads`, technician → `/my-work`, warehouse → `/dispatch`, support → `/service`.

## Health ✅

`GET /api/v1/health` (public).

| Result | Body |
|---|---|
| 200 | `{ status: "ok", db: "up", latencyMs, time, version, region }` |
| 503 | `{ status: "degraded", db: "down", reason, hint, time, version, region }` |

- `version` is the deployed Git commit (e.g. `af8b9a5`) and `region` the serverless region (`bom1` = Mumbai), so one request proves which build is live and where.
- `reason` is a safe category, never the connection string or raw error: `uri_missing`, `uri_invalid` (quotes, spaces, placeholders), `auth_failed` (wrong username or password), `dns` (mistyped cluster host), `timeout` (Atlas Network Access or the cluster is down), `unknown`. Implemented in `src/server/lib/db-errors.ts`, unit-tested in `tests/unit/db-errors.test.ts`, and verified against real Atlas errors.
- Use it for uptime monitors and post-deploy smoke tests.

## Media (GridFS) ✅

Verified end to end against Atlas (31 Oct): auth required (401), one-shot upload + byte-identical read-back, `Range` → 206, mislabelled content rejected (422), chunked session → piece → complete → ranged read.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/v1/files` | `multipart/form-data`: `file` (≤ 4 MB), `kind?` | `201 { id, filename, contentType, size, kind }` |
| POST | `/api/v1/files/uploads` | `{ filename, contentType, size }` (videos up to 50 MB) | `201 { uploadId, pieceBytes, pieces }` |
| PUT | `/api/v1/files/uploads/{uploadId}` | raw bytes, header `x-piece-index` | `200 { received }` |
| POST | `/api/v1/files/uploads/{uploadId}` | none | `201 { id, filename, contentType, size, kind }` |
| GET | `/api/v1/files/{id}` | supports the `Range` header; `?share={token}` for a customer's certificate link | file stream (`206` for ranges), `Cache-Control: private, immutable` |

All media endpoints require a signed-in user. The one exception: `GET /api/v1/files/{id}?share={token}` serves a file to a signed-out viewer only when the token is an active, unrevoked **certificate** link and the file is one of that installation's own photos (anything else `401`). Allowed types: JPEG, PNG, WebP, MP4, QuickTime, WebM.

## Public endpoints

### `POST /api/v1/enquiries` ✅
Website enquiry form (also usable by any external landing page). New enquiries are auto-assigned to the salesperson with the fewest open leads.
```json
{ "name": "Lakshmi Narayana", "phone": "9848012345", "email": "lakshmi.n@example.com", "city": "Hyderabad", "pincode": "500072",
  "addressLine": "Plot 12, KPHB Colony", "capacityKw": 3, "systemType": "on_grid", "wantsSubsidy": true,
  "monthlyBillRs": 2800, "message": "Need subsidy help", "website": "" }
```
`201 { ok: true, reference: "SP-L-0123" }`. Repeat enquiries from the same phone within 30 days attach to the open lead instead of creating duplicates. `website` is a honeypot and must be empty. `email` is required. `phone` takes digits with optional `+`, spaces, `-`, `(`, `)` or `.`; any letter is a `400` ("Use digits only, no letters"), never silently stripped.

`systemType` is `on_grid`, `off_grid`, `panel_set` (panels only) or `unsure`. Businesses (`customerType: "commercial"`) may add `gstin` (15-character format, upper-cased); it is stored on the customer and printed on their tax invoice.

### `POST /api/v1/warranty` ✅ (F20)
Public warranty check behind `/warranty` (the page posts the same input to `lookupWarrantyAction`). POST only, so no phone number or serial lands in a URL. **10 lookups per IP per hour.**
```json
{ "by": "serial", "serial": "GRW3K-H2504-0001", "email": "ramana.rao@example.com" }
{ "by": "phone", "phone": "+91 98480 12345", "last4": "0001", "email": "ramana.rao@example.com" }
```
`200 { ok: true, customer: "V. R****, Kukatpally", units: [{ serial, productName, category, deliveredAt, endsAt, state, label }], workmanship?: { endsAt, state, label } }`. By phone, the last 4 characters of any serial at that customer are a second factor, and every unit there is returned. Only units that reached a customer are found. **Every miss** (unknown serial, in-stock unit, wrong last 4, unknown phone) is the same `404 { error: { code: "NOT_FOUND", message: "No match found." } }`. Never returns a phone, an address or a full name. `website` is a honeypot. `email` is required (validated, not stored and not used for matching); letters in `phone` are a `400`.

### Read-only share links ✅
`/share/{token}` (page, no login) opens one of two scopes. The token is checked against its stored record on every request, so expiry and revocation take effect at once.

| Scope | Made by | Shows | Expiry |
|---|---|---|---|
| `dashboard` | the director (`createShareLinkAction`) | the dashboard with customer names masked (`L. N****`); `GET /api/v1/reports/profit?range=…&token={token}` downloads the same numbers | 1–30 days |
| `certificate` | completing an installation, or "Create customer link" on the job | that installation's certificate: serials with warranty dates, workmanship warranty, photos (via `?share=`), signature. No phone number | 90 days, one active link per job |

A certificate token never opens the profit CSV (`403`) or any other job's photos.

## Staff endpoints ✅

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/search?q=` | any staff (results filtered by role) | ⌘K global search → `{ results: [{ type, id, title, subtitle, href, badge }] }` across customers, leads, quotes, orders, serials, tickets and invoices (≤ 5 per type). Phone with or without `+91`/spaces, full or last 4+ digits; serial full or partial; names; document numbers. Serial results carry the warranty badge ("In warranty · 6 mo left"). Support's links open `/service/new?serial=…` with the warranty already decided. `401` signed out |
| GET | `/api/v1/reports/profit?range=today\|week\|month\|all` | admin (or a valid share `token`) | CSV: profit per installation — revenue excl. GST, material (GRN cost per serial), labour (hours × rate), site extras, warranty repairs, profit, margin. UTF-8 with BOM for Excel. Bad token `403` |
| GET | `/api/v1/reports/payroll?month=YYYY-MM` | admin | CSV: per technician — rate, installation hours, service hours, jobs, payout |
| GET | `/api/v1/reports/invoices?status=open\|overdue\|paid&type=sale\|service` | sales, support | CSV for the accountant: number, type, dates, customer and GSTIN, taxable value, CGST, SGST, total, paid, due, status, overdue. Same filters as `/invoices` |
| GET | `/api/v1/reports/tickets?status=open_all\|<status>&tech=<userId>` | support | CSV: every ticket not closed by default, with age in days, SLA breach, warranty state and basis, billable, technician |

Every CSV is UTF-8 with a BOM for Excel, and text that would start a spreadsheet formula (`=`, `+`, `-`, `@`) is prefixed with an apostrophe, because names arrive from the public enquiry form.

## Server Actions (by module)

Each action has the signature `(prev: ActionState, formData: FormData) => Promise<ActionState>` and runs through `runAction(roles, fn)`, which handles auth, role checks, DB connection and error mapping. It returns `{ ok, message?, fieldErrors?, data? }`.

| Module | Actions | Phase |
|---|---|---|
| Auth | `loginAction`, `logoutAction` | ✅ 0 |
| Leads & surveys | create enquiry (+ public `submitEnquiryAction`), mark contacted, qualify, mark lost, reopen, assign, schedule survey, submit survey (photos must exist in GridFS), approve / re-survey / not feasible | ✅ 1 |
| Quotes & orders | `saveQuoteAction` (JSON; server re-prices from the catalog, survey-approval gate; **sending a quote that lacks a part its package needs** (`REQUIRED_COMPONENTS`, R-24) fails with `fieldErrors.sendWithMissing` unless `sendWithMissing: true`, and the gap is written on the timeline), `markQuoteSentAction` (same check; form field `sendWithMissing=on`), accept → order (+ subsidy tracker, supersedes other quotes; expired quotes blocked), reject, `recordPaymentAction` (first payment confirms the order → pick list, plus an installation job with 3 installers free that day **only when the order sells the installation line**, BR-07; a bare Panel Set books no crew; overpayment blocked; with `invoiceId` it pays a service invoice), cancel (admin; releases serials + job) | ✅ 1 |
| Inventory & dispatch | `receiveGoodsAction` (JSON GRN with serials), `scanSerialAction` / `unscanSerialAction` (allocate / release), `bulkPickAction`, `dispatchOrderAction` (gate: everything packed, `DISPATCH_INCOMPLETE`; issues the sale invoice), `deliverOrderAction` (→ warranties; a hardware-only order closes here), `adjustStockAction` (admin; bulk items only, signed whole-number change + reason, through the ledger, never below zero), `writeOffSerialAction` (admin; an in-stock unit becomes `faulty` and leaves stock, reason in its history) | ✅ 2 |
| Jobs | `rescheduleJobAction` (date + crew; double bookings **and installing before DISCOM feasibility approval** returned as warnings), `startJobAction` (crew only; gate: delivered), `completeJobAction` (BR-14 proof, extras to stock and order costs, time logs → commissioned; creates the customer's certificate link), `certificateLinkAction` (sales, crew, support; creates or reuses the job's 90-day certificate link, returns `data.token`) | ✅ 2–3 |
| Customers | none (read-only: `/customers` and `/customers/{id}` read `listCustomers` / `getCustomer360`) | ✅ 3 |
| Service | `createTicketAction` (warranty decided from the serial, or the workmanship warranty when there is no serial; redirects to the ticket), `assignTicketAction` (books a service visit on the technician's calendar), `startTicketAction`, `overrideBillingAction` (reason required), `resolveTicketAction` (parts JSON, labour, replacement serial of the same product; out of warranty → GST service invoice, in warranty → cost charged to the order), `confirmTicketAction` (who / channel / when), `closeTicketAction` (only from `customer_confirmed`), `reopenTicketAction` ("Not fixed") | ✅ 3 |
| Finance | `advanceSubsidyAction` (next stage only; application number for Applied, amount for Disbursed), `addSubsidyDocumentAction` (kind + 1–6 photo ids already in GridFS + reference; residential on-grid orders only), `createShareLinkAction` (1–30 days, returns the token), `revokeShareLinkAction` (dashboard or certificate links). Site extras come from job completion; warranty costs from resolved tickets | ✅ 3 |
| Public | `submitEnquiryAction`, `lookupWarrantyAction` (same rules as `POST /api/v1/warranty`) | ✅ 1, 3 |
