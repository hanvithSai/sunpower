# Engineering.md: Decisions, rationale and standards

Each decision below records **what** we chose, **why**, and **how it helps** later.

## Platform

| Decision | Why | How it helps later |
|---|---|---|
| **Next.js 16 App Router monolith** (TypeScript strict) | One repo, one deploy and one type system for UI + API. Server Components keep data access on the server | Two developers ship features end to end without API contract drift. Easy Vercel hosting |
| **Cache Components + Partial Prefetching** (`next.config.ts`) | The static shell renders instantly while session/DB data streams in | Fast perceived performance on slow mobile networks at customer sites. Ready for Next's next major, where both are default |
| **`proxy.ts`** (Next 16's replacement for `middleware.ts`) | Optimistic auth redirect without a DB hit | Signed-out users never see protected shells. API routes keep JSON 401s |
| **MongoDB Atlas + Mongoose 9** | A document model fits nested records (BOM lines, pick lists, checklists, histories) and the free M0 tier fits the budget | Schema-validated documents. Transactions for multi-step automations |
| **Tailwind CSS v4 + shadcn-style components (Radix primitives)** | Accessible, unstyled primitives with our own Apple-inspired tokens | A consistent design system (`product/Style_Guide.md`). No vendor lock-in |
| **Auth.js v5** (Credentials + JWT) | Maintained, widely used, open source, and supports Next 16. We avoid hand-rolled auth | Security review is easier. OAuth or magic links can be added later as providers |
| **PostHog (free tier)** | One open-source tool for product analytics, session replay and error tracking | Funnels for lead → order conversion and error alerts without extra vendors |
| **GridFS for photos/videos** | Keeps media next to the data with no extra account; chunked uploads respect Vercel's 4.5 MB limit | Only `services/core/files.ts` changes if we move to object storage |
| **GitHub Actions CI + Vercel deploys** | Free for this scale. Every PR is linted, type-checked, tested and built | Broken code can't reach `main`. Preview URLs for review |

## Code organisation

- `src/lib`: **pure, framework-free business rules** (GST, subsidy, warranty, IST dates, state machines, validation). Fully unit-testable and shared by browser and server.
- `src/server/models`: the single source of truth for data shape (see `DB.md`).
- `src/server/services`: business logic. No HTTP and no React. Reused by actions, API routes, tests and the seed script.
- `src/server/actions`: thin Server Actions: validate → call service → revalidate → return `ActionState`.
- `src/app/api/v1`: versioned REST for public and integration traffic (`API.md`).
- `src/components/{ui,shared,shell,modules}`: primitives → shared building blocks → app chrome → feature components.
- **Folder ownership** (`.github/CODEOWNERS`): frontend and product belong to Hanvith; server, DB, API and tests belong to Vamshi. Merge conflicts are avoided by design.

## Correctness rules

1. **Money is integer paise.** It is formatted only at the edge (`formatINR` → ₹1,50,000).
2. **Every status change goes through a state machine** (`src/lib/workflows.ts` + `assertTransition`).
3. **Multi-document changes run in `withTransaction`.** Pass `session` to every query inside.
4. **Stock moves only through `moveStock()`** (atomic `$inc` with a non-negative guard plus a ledger row).
5. **Document numbers come from atomic counters.** GST invoice numbers reset each financial year.
6. **Snapshots on sales documents**, so catalog edits never alter history.
7. **Every mutation writes an Activity** (audit trail and timelines).
8. **Dates are stored in UTC and displayed in IST.** Date ranges are computed on IST day boundaries.

## Validation and errors

- Zod schemas (`src/lib/validation/*`) validate on the server (authoritative) and mirror HTML constraints on the client.
- Services throw `AppError(code, message, fieldErrors?)`. `runAction` maps errors to toasts and inline field errors. `apiHandler` maps them to JSON plus an HTTP status.
- Unexpected errors are logged server-side with a prefix and return a friendly generic message (no stack traces leak).

## Security checklist

- bcrypt password hashes (`select: false`), httpOnly JWT cookies, and `AUTH_SECRET` kept only in the environment.
- Role checks in the proxy, on pages and on every mutation (defence in depth).
- Rate limiting and a honeypot on public endpoints. Privacy masking on the public warranty lookup.
- No PII in analytics. `poweredByHeader` disabled.
- Uploads: type allow-list, size caps, server-side validation, auth required for read and write.

## Performance

- Cached Mongoose connection per serverless instance. Lean queries, indexes on every list filter, pagination.
- Static shells plus streaming. Images compressed in the browser before upload.
- **Self-hosted Inter** (`next/font/local`, SIL OFL): no Google Fonts call at build or run time, so builds and venue demos work on slow or offline networks.
- **Slow-network tolerance:** a 30 s server-selection window and IPv4-only sockets in `connectDB()`. On networks with slow SRV DNS, use Atlas's standard (non-SRV) connection string locally (Setup.md §10).
- Analytics are sent after the response (`after()`), never on the critical path.

## Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit ✅ | Vitest (`npm test`, runs in CI) — 33 tests | database failure classification; the forms exactly as the browser posts them (FormData → Zod: completion form, GRN, scans, tickets, overrides, confirmations); the packing gate (BR-02); the ticket state machine's confirmation gate (BR-06) |
| Flow smoke checks ✅ | `scripts/check-*-flow.ts` (tsx, real database; replace an integration suite) | lead → survey gate (10), quote → order → payment (15), **ops** GRN → crew booking → packing guards → dispatch + invoice → warranties → installation proof (46), **service** search → warranty per serial / workmanship → ₹0 replacement charged to the order → auto invoice → confirm-before-close (29), **finance** costing from actuals → dashboard → subsidy → share links → payroll (21). The last three build their own orders and top up stock, so they re-run safely on any development database |
| Seed verification ✅ | ad-hoc against a fresh database | stock equals the ledger for every product; serialized stock equals in-stock units; warranty dates of the backdated scenes; invoice numbering per financial year; idempotent re-run |
| Rendering checks ✅ | signed-in `curl` of every page per role, plus a production build | every page renders with real data (no error boundary), and the build catches Cache Components mistakes |
| End-to-end ✂️ | Playwright | cut on 31 Oct in favour of the flow checks above (Plan.md decision 8); browser interaction (camera, signature, form submits) is checked by hand |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every PR and every push to `main`.

## Incidents and lessons learned

| # | What happened | Root cause | Fix | Prevention |
|---|---|---|---|---|
| 1 | Seed and Atlas connections timed out at the venue | Phone-hotspot uplink of about 5 KB/s and 2–7 s DNS lookups | Standard (non-SRV) Atlas string locally, 30 s server-selection timeout, IPv4 sockets, bulk writes in the seed | Batch database writes; keep git pushes under about 200 KB |
| 2 | Dev server reported "uncached data … outside of <Suspense>" | Pages read the session without a route-level Suspense boundary (Partial Prefetching) | `loading.tsx` in every `(app)` route folder | Rule documented in Architecture §3 and Agent_Content |
| 3 | ⌘K palette threw "Cannot read properties of undefined (reading toLowerCase)" | Browser autofill fires synthetic `keydown` events without a `key` | Guard `typeof event.key === "string"` | Never assume optional DOM event fields exist |
| 4 | **Production sign-in failed** ("We couldn't sign you in right now") | The `MONGODB_URI` set in Vercel had credentials Atlas rejected. `/api/v1/health` failed in about 2 s every time: a missing variable fails instantly and an IP block hangs for the 30 s timeout, so Atlas was reachable but refused the login | Updated the variable in Vercel and redeployed; health `db: up` on `681cea0` | Env-var checklist in Setup §8 (no quotes or placeholders; redeploy after edits; verify health `db` and `version`); the health response now reports a safe failure `reason` (`auth_failed`, `uri_invalid`, `uri_missing`, `dns`, `timeout`) plus `version` and `region` |
| 5 | `next dev` kept serving an old version of a service after it was edited (the certificate missed its workmanship row) | Turbopack kept a stale server module for `services/jobs.ts` even after the file changed; a production build of the same code was correct | Verified with `next build && next start` on another port | When dev output disagrees with a direct service call, restart `npm run dev` before debugging (Setup §10) |
| 6 | Production looked empty after "seeding" | `.env.local` pointed at the local database, so `npm run seed -- --yes` seeded local; `--yes` only confirms, it does not choose the database | Re-ran with `MONGODB_URI` set to Vercel's string for that one command; checked the `Connected to … / sunpower` line | Setup §6 shows how to target Atlas; always read the `Connected to` line before a remote seed |
| 7 | Seed pipeline stopped half-way on a busy development database | Earlier flow-check runs had used up the in-stock panels and controllers, so packing came up short | Pipeline tops up stock with a goods receipt before packing and resumes per customer on re-run | Seeds must not assume an empty database; flow checks top up stock too |

## Standards

- TypeScript `strict`. The ESLint Next.js core-web-vitals + TypeScript rules must pass.
- Explainer comments at the top of every non-trivial file. Names follow the business vocabulary (lead, survey, quote, order, pick list, serial, ticket).
- Accessibility: labelled inputs, keyboard navigation, visible focus rings, 44 px touch targets on technician screens, WCAG AA contrast.
- Docs updated with every change: `Plan.md`, `Agent_Content.md`, and `engineering/*` when contracts change.
