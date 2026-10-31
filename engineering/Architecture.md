# Architecture.md: System design, data flow and technical architecture

## 1. System context

```mermaid
flowchart LR
  subgraph Users
    H[Homeowner<br/>web form · warranty check]
    S[Staff<br/>director · sales · warehouse · support]
    T[Technician<br/>phone / tablet]
  end
  subgraph Vercel["Vercel (free tier)"]
    P[proxy.ts<br/>auth gate]
    N[Next.js 16 app<br/>RSC · Server Actions · /api/v1]
  end
  DB[(MongoDB Atlas<br/>data + GridFS media)]
  PH[PostHog<br/>analytics · errors]
  GH[GitHub Actions<br/>CI]
  DNS[Namecheap DNS]

  H --> DNS --> P
  S --> P
  T --> P
  P --> N
  N --> DB
  N -. events .-> PH
  GH -. checks PRs .-> N
```

One **monolith repository** holds the frontend and backend. That keeps one deployable unit and one type system, and lets two developers move fast without contract drift between services.

## 2. Layers inside the app

```mermaid
flowchart TB
  UI["UI: src/app (routes) + src/components<br/>Server Components read · Client Components interact"]
  ACT["Server Actions: src/server/actions/*<br/>thin: parse (Zod) → service → revalidate"]
  API["Route handlers: src/app/api/v1/*<br/>public + integrations, JSON errors"]
  SVC["Services: src/server/services/*<br/>business rules, state machines, automations"]
  CORE["Core services: counters · activity log · invoicing · stock ledger · files"]
  MOD["Models: src/server/models/* (Mongoose)"]
  LIB["Pure domain lib: src/lib/*<br/>constants · workflows · money · GST · subsidy · warranty · costing · crew · analytics · dates · validation"]

  UI --> ACT --> SVC
  UI -->|reads| SVC
  API --> SVC
  SVC --> CORE --> MOD
  SVC --> MOD
  UI --> LIB
  SVC --> LIB
```

- **Services never know about HTTP or React.** The seed script, tests, Server Actions and API routes all reuse them.
- **The pure lib is shared by client and server.** The same Zod schema validates a form in the browser and on the server, and the same GST code computes the live quote preview and the stored invoice.
- **The Data Access Layer** (`src/server/auth/session.ts`): every page and action begins with `requireUser(roles)` / `runAction(roles)`, so authorisation can't be forgotten.

## 3. Request lifecycle (staff page)

```mermaid
sequenceDiagram
  participant B as Browser
  participant X as proxy.ts
  participant L as (app)/layout (Suspense)
  participant P as Page (Server Component)
  participant S as Service
  participant M as MongoDB
  B->>X: GET /orders/SP-O-0107
  X->>X: verify JWT cookie (no DB)
  alt signed out
    X-->>B: 307 /login?callbackUrl=...
  end
  X->>L: render static shell instantly
  L->>P: stream inside <Suspense>
  P->>P: requireUser(["sales","warehouse"])
  P->>S: getOrder(id)
  S->>M: lean queries (indexed)
  M-->>S: documents
  S-->>P: plain objects
  P-->>B: streamed HTML + RSC payload
```

**Cache Components** (`cacheComponents: true`) makes the shell (sidebar, header, skeletons) prerender and appear instantly. Session- and DB-dependent content streams in behind `<Suspense>`. **Partial Prefetching** prefetches one reusable shell per route, which makes navigation feel instant.

**Rendering rule:** every route folder under `src/app/(app)` has its own `loading.tsx`. With Partial Prefetching, a page that reads the session needs a Suspense boundary *below* the shared app layout for client navigations to be instant. Without one, the Next.js dev validation reports "uncached data … outside of <Suspense>". We hit this on the module placeholders and fixed it with route-level boundaries.

## 4. The lifecycle as one connected flow (golden path)

```mermaid
sequenceDiagram
  autonumber
  participant C as Homeowner
  participant Sales
  participant Tech as Technician
  participant WH as Warehouse
  participant Sys as SunPower OS
  C->>Sys: Enquiry (web form)
  Sys-->>Sales: Lead SP-L-… (SLA timer starts)
  Sales->>Sys: Qualify + schedule survey
  Tech->>Sys: Survey (direction, tilt, cable, photos)
  Sales->>Sys: Approve survey → quote unlocked
  Sales->>Sys: Quote from "3 kW On-Grid" template (BOM auto-expands, GST + subsidy)
  C->>Sales: Accepts, pays advance
  Sales->>Sys: Record payment
  Sys-->>WH: Pick list created
  Sys-->>Tech: Installation job on the crew calendar
  WH->>Sys: Scan every serial, tick bulk lines → dispatch
  Sys-->>Sys: Stock out, GST sale invoice issued (advance applied)
  WH->>Sys: Mark delivered
  Sys-->>Sys: Warranty clock starts for every serial
  Tech->>Sys: Start (only after delivery) → completion form + photos + customer signature
  Sys-->>Sales: Order commissioned → certificate, crew hours, subsidy tracking
  Sys-->>C: Certificate link on WhatsApp (every serial and warranty date)
  C->>Sys: Checks cover at /warranty (serial, or phone + last 4)
  C->>Sys: Breakdown months later (support finds the serial with ⌘K)
  Sys-->>Sys: Warranty decided per serial (or workmanship) → ₹0 + cost to the order, or auto invoice
```

Automations run as **service-level side effects inside one MongoDB transaction**, so a crash can never leave an order confirmed without its pick list or job.

| Trigger | Automatic effects |
|---|---|
| First payment on an order | status confirmed, pick list, and (when the order sells the installation line) an installation job ~4 days out with 3 installers free that day (`core/crew.ts`); a hardware-only Panel Set books no crew |
| All serials scanned and bulk lines ticked | status ready_to_dispatch (an un-scan moves it back) |
| Dispatch | stock moves out, serials in transit, GST sale invoice with payments applied (BR-18) |
| Delivery | warranty start/end per serial from the months sold on the order; a hardware-only order closes |
| Job completed (installation) | serials installed, order commissioned, a time log per crew member, extra material out of stock and into the order's costs, and a 90-day certificate link for the customer (sent from the job page on WhatsApp) |
| Ticket raised | warranty state and basis (serial or workmanship) frozen on the ticket |
| Ticket resolved in warranty | ₹0 to the customer; parts at cost + labour charged to the original order (`extraCosts`, kind `warranty`); service visit completed with a time log |
| Ticket resolved out of warranty | GST service invoice for parts + labour, stock issued |
| Customer confirms the fix | ticket `customer_confirmed`, then it can close |

## 5. Gates (process enforcement)

| Gate | Where enforced |
|---|---|
| No quote before survey approval | quote service + locked UI on the lead |
| No quote sent without a part its package needs (earthing, inverter, battery…) unless the salesperson confirms, which is logged | quote service (`missingComponents`, R-24) + builder warning |
| No installation booked before DISCOM feasibility approval without a warning | job service (reschedule warnings) + job and order pages |
| No dispatch until every serialized unit is scanned and every line is picked | dispatch service (`DISPATCH_INCOMPLETE`, re-checked in the transaction) |
| A scan must be the right product, in stock and not packed for another order | dispatch service |
| No installation start before materials are delivered; only the booked crew can start or complete | job service |
| No completion without times, confirmed kW (reason if different), generation test, kit check, a photo and the signature | job service (BR-14) |
| A replacement unit must be the same product and in stock | ticket service (BR-15) |
| No ticket closure without customer confirmation | ticket state machine (`resolved → customer_confirmed → closed`) |
| Share links work only until expiry or revocation; a certificate link opens only its own job (and its photos), never the numbers | finance service (checked on every view) + files and profit CSV routes |
| Stock changes only through the ledger; bulk corrections and serial write-offs are director-only with a reason | inventory service (`moveStock`, never below zero) |
| Every status change must be legal | `assertTransition(entity, FLOW, from, to)` |

## 6. Security model

- **Authentication:** Auth.js v5 Credentials provider. Passwords are bcrypt hashes. The session is a signed + encrypted JWT in an httpOnly cookie that expires after 12 h.
- **Authorisation:** roles (`admin`, `sales`, `technician`, `warehouse`, `support`) are checked in three places: `proxy.ts` (signed-in only), pages via `requireUser(roles)`, and every mutation via `runAction(roles)`. Admin may do everything.
- **Input validation:** Zod on every action and endpoint, plus HTML constraints in forms.
- **Abuse protection** on public endpoints: rate limits and a honeypot field.
- **Privacy:** the public warranty lookup (POST only, 10 per IP per hour, one answer for every miss, last 4 of a serial as a second factor for phone lookups) masks names and never returns phones or addresses. The customer's certificate link leaves out the phone. Analytics events never contain customer PII.
- **CSV exports** prefix any text that would start a spreadsheet formula, since customer names come from the public form.
- **Secrets:** only in environment variables (`.env.local` locally, Vercel project settings in production).

## 7. Media pipeline

```mermaid
flowchart LR
  Cam[Phone camera] --> Cmp[Browser compresses image<br/>≤1600px JPEG]
  Cmp -->|≤4 MB| One[POST /api/v1/files]
  Vid[Video ≤50 MB] -->|4 MB pieces| Chunk[PUT /api/v1/files/uploads/:id]
  One --> GFS[(GridFS media.*)]
  Chunk --> GFS
  GFS -->|Range requests| View[GET /api/v1/files/:id]
```

Vercel caps request bodies at 4.5 MB, so large files are split into 16 × 255 KiB pieces that map 1:1 onto GridFS chunks. No extra storage vendor is needed.

## 8. Observability

- **PostHog:** product analytics (event taxonomy in `product/Analytics.md`). Business events are captured server-side in `after()` so they never slow a request, plus browser pageviews and exception autocapture.
- **`/api/v1/health`** for uptime checks. Vercel runtime logs record unexpected errors (`[action]` / `[api]` prefixes).

## 9. Delivery pipeline

Production runs at **https://www.sunpowersolutions.me** (Namecheap DNS → Vercel; the apex redirects to `www`), with **https://sunpowersolutions.vercel.app** as the Vercel URL.

**Region:** Vercel functions run in **Mumbai (`bom1`)**, pinned in `vercel.json`, next to users in India and the Atlas cluster in Asia. They were in Washington DC (`iad1`, the default) until 31 Oct, when every request crossed India → US → Atlas (about 1.8 s of cold database latency). `/api/v1/health` reports the live `region`.

```mermaid
flowchart LR
  Dev[feature branch] --> PR[Pull request]
  PR --> CI[GitHub Actions: lint · typecheck · test · build]
  PR --> Prev[Vercel preview URL]
  CI --> Merge[merge to main]
  Merge --> Prod[Vercel production + Namecheap domain]
```

## 10. Scalability and evolution
- Stateless app servers on Vercel scale horizontally. Mongoose connections are cached per instance to respect Atlas limits.
- Indexes cover every list filter (status + date, technician + schedule, serial, phone).
- Clear seams for growth: swap GridFS for object storage, add a queue for notifications (email/WhatsApp Business API), and add more DISCOM/state rules in `src/lib/subsidy.ts`.
