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

## Testing strategy (Phase 4)

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | `src/lib` rules: GST splits, subsidy slabs, warranty dates, IST ranges, state machines, validators |
| Integration | Vitest + mongodb-memory-server (replica set) | services: counters, invoicing, stock ledger, payment → order confirmation, dispatch gate, delivery → warranties, ticket billing |
| End-to-end | Playwright (planned) | golden path smoke test on the preview URL |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every PR and every push to `main`.

## Standards

- TypeScript `strict`. The ESLint Next.js core-web-vitals + TypeScript rules must pass.
- Explainer comments at the top of every non-trivial file. Names follow the business vocabulary (lead, survey, quote, order, pick list, serial, ticket).
- Accessibility: labelled inputs, keyboard navigation, visible focus rings, 44 px touch targets on technician screens, WCAG AA contrast.
- Docs updated with every change: `Plan.md`, `Agent_Content.md`, and `engineering/*` when contracts change.
