# API.md: HTTP endpoints and Server Actions

SunPower OS is a Next.js monolith. Staff screens call **Server Actions** (type-safe RPC over POST) for mutations and read data in **Server Components**. Public and integration traffic uses the versioned REST API under **`/api/v1`**.

Status legend: ✅ implemented · 🟨 in progress · 🗓️ planned (phase noted)

## Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` (breaking changes → `/api/v2`) |
| Format | JSON in and out (`Content-Type: application/json`), except file uploads/downloads and CSV exports |
| Auth | Session cookie set by Auth.js (`/api/auth/*`). Staff endpoints return **401** when signed out and **403** for the wrong role. Admins can call everything |
| Errors | `{ "error": { "code": "VALIDATION", "message": "Please fix the highlighted fields.", "fieldErrors": { "phone": "Enter a valid 10-digit Indian mobile number" } } }` |
| Status codes | 200 OK · 201 Created · 206 Partial Content (media ranges) · 400 BAD_REQUEST · 401 UNAUTHORIZED · 403 FORBIDDEN · 404 NOT_FOUND · 409 INVALID_STATE / CONFLICT / INSUFFICIENT_STOCK · 422 VALIDATION · 429 RATE_LIMITED · 500 INTERNAL |
| Money | integer **paise** in payloads (`amountPaise`). Forms accept rupees and convert |
| Dates | ISO-8601 UTC strings. UIs display in IST (Asia/Kolkata) |
| Rate limits | Public endpoints: per-IP fixed window (enquiries 5 / 10 min, warranty lookup 20 / 10 min) |
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

`GET /api/v1/health` (public). Returns `200 { status: "ok", db: "up", latencyMs, time, version }`, or `503 { status: "degraded", db: "down" }`. Use it for uptime monitors and post-deploy smoke tests.

## Media (GridFS) ✅

Verified end to end against Atlas (31 Oct): auth required (401), one-shot upload + byte-identical read-back, `Range` → 206, mislabelled content rejected (422), chunked session → piece → complete → ranged read.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/v1/files` | `multipart/form-data`: `file` (≤ 4 MB), `kind?` | `201 { id, filename, contentType, size, kind }` |
| POST | `/api/v1/files/uploads` | `{ filename, contentType, size }` (videos up to 50 MB) | `201 { uploadId, pieceBytes, pieces }` |
| PUT | `/api/v1/files/uploads/{uploadId}` | raw bytes, header `x-piece-index` | `200 { received }` |
| POST | `/api/v1/files/uploads/{uploadId}` | none | `201 { id, filename, contentType, size, kind }` |
| GET | `/api/v1/files/{id}` | supports the `Range` header | file stream (`206` for ranges), `Cache-Control: private, immutable` |

All media endpoints require a signed-in user. Allowed types: JPEG, PNG, WebP, MP4, QuickTime, WebM.

## Public endpoints 🗓️

### `POST /api/v1/enquiries` ✅
Website enquiry form (also usable by any external landing page). New enquiries are auto-assigned to the salesperson with the fewest open leads.
```json
{ "name": "Lakshmi Narayana", "phone": "9848012345", "email": "", "city": "Hyderabad", "pincode": "500072",
  "addressLine": "Plot 12, KPHB Colony", "capacityKw": 3, "systemType": "on_grid", "wantsSubsidy": true,
  "monthlyBillRs": 2800, "message": "Need subsidy help", "website": "" }
```
`201 { ok: true, reference: "SP-L-0123" }`. Repeat enquiries from the same phone within 30 days attach to the open lead instead of creating duplicates. `website` is a honeypot and must be empty.

### `GET /api/v1/warranty?serial=` (Phase 3)
`200 { serial, product, installedOn, warrantyEndsOn, state, customer: { maskedName, city } }`. Never returns phone numbers or addresses.

## Staff endpoints 🗓️

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/search?q=` | any staff | ⌘K global search → `{ results: [{ type, id, title, subtitle, href, badge }] }` across customers, leads, quotes, orders, serials, tickets and invoices (≤ 5 per type) — Phase 3 |
| GET | `/api/v1/reports/profit?range=month` | admin | CSV: profit per job (revenue, material, labour, extras, margin) — Phase 3 |
| GET | `/api/v1/reports/payroll?month=YYYY-MM` | admin | CSV: technician hours and payout — Phase 3 |

## Server Actions (by module)

Each action has the signature `(prev: ActionState, formData: FormData) => Promise<ActionState>` and runs through `runAction(roles, fn)`, which handles auth, role checks, DB connection and error mapping. It returns `{ ok, message?, fieldErrors?, data? }`.

| Module | Actions | Phase |
|---|---|---|
| Auth | `loginAction`, `logoutAction` | ✅ 0 |
| Leads & surveys | create enquiry (+ public `submitEnquiryAction`), mark contacted, qualify, mark lost, reopen, assign, schedule survey, submit survey (photos must exist in GridFS), approve / re-survey / not feasible | ✅ 1 |
| Quotes & orders | save quote (draft/sent), mark sent, accept → order, reject, revise, record payment (confirms the order → pick list + installation job), cancel | 🗓️ 1 |
| Inventory & dispatch | goods receipt with serials, stock adjustment, allocate/remove serial, mark picked, dispatch (gate: all serials scanned), deliver (→ warranties + sale invoice) | 🗓️ 2 |
| Jobs | reschedule, reassign crew, start (gate: delivered), complete (photos + signature + time logs → commissioned) | 🗓️ 2 |
| Service | create ticket (warranty snapshot), assign, schedule visit, resolve (parts, labour, replacement, auto invoice if out of warranty), confirm / reopen | 🗓️ 3 |
| Finance | record invoice payment, update subsidy stage, add site cost, close project, create/revoke share link | 🗓️ 3 |
