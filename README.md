# SunPower OS

**The digital backbone for a rooftop-solar company. One platform from the first enquiry to the 20-year warranty.**

[![CI](https://github.com/hanvithSai/sunpower/actions/workflows/ci.yml/badge.svg)](https://github.com/hanvithSai/sunpower/actions/workflows/ci.yml)

**Live:** [www.sunpowersolutions.me](https://www.sunpowersolutions.me) · Vercel: [sunpowersolutions.vercel.app](https://sunpowersolutions.vercel.app) · Staff sign-in: [/login](https://www.sunpowersolutions.me/login)

Built for **SunPower Solutions** (Telangana) at the Odoo x GCET Hackathon 2026 (Team 19). The company installs about 40 rooftop systems a month with 15 technicians. Today enquiries get lost on WhatsApp, quotes miss parts, serial numbers live on paper, and nobody knows which jobs made money. SunPower OS replaces that with one connected flow:

```
Enquiry → Qualification → Site survey → Quote (auto BOM) → Order & payment → Dispatch (serial scan)
        → Delivery (warranty starts) → Installation (photos + signature) → Service tickets → Month-end P&L
```

## Current status (31 Oct 2026)

| Area | Status |
|---|---|
| Production | ✅ Live at [www.sunpowersolutions.me](https://www.sunpowersolutions.me), served from Mumbai (`bom1`); [health](https://www.sunpowersolutions.me/api/v1/health) shows database, version and region |
| Phase 0: foundation (auth, data model, design system, CI/CD) | ✅ Done |
| Phase 1: leads → surveys → quotes → orders & payments | ✅ Done, verified end to end on Atlas |
| Phase 2: goods receipts & serials, dispatch scanning, invoice at dispatch, warranties on delivery, crew booking, technician My work, installation proof & certificate | ✅ Done |
| Phase 3: ⌘K search, service desk, job costing, director dashboard & share link, invoices, subsidy board, payroll, full demo seed | ✅ Done; production seeded and verified |
| Phase 3b + verification (31 Oct, 20:30): public warranty check, customer certificate link on WhatsApp, subsidy papers, invoice/ticket CSVs, Customer 360, Panel Sets, missing-parts gate on quotes, business GSTIN, stock corrections | ✅ Done locally; push + Atlas re-seed pending ([Human_Tasks](Human_Tasks.md) #18) |
| Next: analytics key in Vercel, polish, demo video | 🗓️ See [Plan.md](Plan.md) |

## Highlights

- **Enquiries never vanish:** web, WhatsApp, call and walk-in leads land in one pipeline with a 2-hour response SLA.
- **Process gates:** no quote before survey approval, no dispatch until every serial is scanned and every bulk line ticked, no installation start before delivery, no ticket closed until the customer confirms.
- **Kit that's always right:** the brief's four packages (1–5 kW On-Grid, Off-Grid, hardware-only Panel Set, and Installation as a service line) expand into the full bill of materials, with GST (CGST/SGST) and the PM Surya Ghar subsidy calculated automatically. A quote missing a part its package needs (say, the earthing kit) can't be sent without an explicit OK.
- **Automations:** a payment creates the pick list and books a crew that's free that day; dispatch issues the GST invoice; delivery starts every serial's warranty clock; completion writes the crew's hours and the certificate, and the customer gets that certificate as a link on WhatsApp.
- **Support in seconds:** ⌘K by phone, name or the last digits of a serial, with live warranty status. Faults with no serial (wiring, earthing) are covered by a 5-year workmanship warranty. Free repairs cost the customer ₹0 and are charged to that installation's profit; out-of-warranty repairs are invoiced automatically. Customers can check their own cover at `/warranty`, and staff see each customer's whole history on one page.
- **Director's view:** today/week/month KPIs, profit per job from actual costs (losers first, with the cause), every customer still waiting on a step, advances held, open repairs, subsidy pipeline, payroll, and an expiring read-only share link with CSV.

## Tech stack

Next.js 16 (App Router, Cache Components) · TypeScript · MongoDB Atlas + Mongoose · Auth.js v5 · Tailwind CSS v4 + Radix · Zod · PostHog · Vercel · GitHub Actions. Everything is open source or free tier.

## Quick start

```bash
git clone https://github.com/hanvithSai/sunpower.git && cd sunpower
npm install
cp .env.example .env.local      # set MONGODB_URI and AUTH_SECRET
npm run seed                    # staff, catalog, stock, 14 months of history, today's pipeline (add -- --yes for Atlas)
npm run dev                     # http://localhost:3000
```

The full Windows and macOS guide is in [Setup.md](Setup.md). No Atlas yet? Run `npm run db:local` for an in-memory MongoDB.

### Try the brief's scenes (seeded data)

| Scene | Where to look |
|---|---|
| A homeowner's enquiry waiting too long | Sign in as `sales@` → Leads: two enquiries are past the 2-hour call-back SLA |
| Pack and dispatch with serial scanning | `warehouse@` → Dispatch → any order "To pack" → scan or type serials (wrong products are refused) |
| The crew on the roof | `tech@` → My work shows Ravi's surveys, installations and service visits. For the completion form, `director@` (who can act for any crew) → Installations → Usha Rani's job, already in progress → photos, signature, Complete |
| Rainy-season breakdown, 18 months later | `support@` → ⌘K `GRW3K-H2504` → Venkata Ramana Rao's inverter, "In warranty · 6 mo left" → raise a ₹0 ticket |
| Out of warranty | ⌘K `Padmavathi` → her inverter expired 4 months ago → a repair is invoiced automatically |
| The director's month-end | `director@` → Dashboard: profit per job (three loss-makers with causes), unfinished steps, subsidy, Share & export |
| A homeowner checks their warranty | Signed out → [/warranty](https://www.sunpowersolutions.me/warranty) → serial `GRW3K-H2504-0001` |
| One customer, everything | ⌘K `Venkata Ramana` → the customer → orders, every serial with its warranty, tickets, invoices, timeline |
| Proof sent to the customer | Any completed installation → "Send on WhatsApp" opens the certificate link (no login needed) |

Demo logins (password `SunPower@2026`): `director@`, `sales@`, `tech@`, `warehouse@`, `support@` with the domain `sunpower.demo`.

Flow smoke checks against a development database: `check-lead-flow`, `check-sale-flow`, `check-ops-flow` (55 checks), `check-service-flow` (29) and `check-finance-flow` (36) in `scripts/` (148 in all), plus 55 unit tests (`npm test`). See [Setup.md](Setup.md#flow-smoke-checks-real-database).

## Documentation

| Doc | What's inside |
|---|---|
| [Plan.md](Plan.md) | Single source of truth: phases, owners, status, ETA |
| [product/](product/) | PRD, features, personas, analytics plan, style guide, requirements matrix |
| [engineering/](engineering/) | Engineering decisions, API, DB schema, architecture diagrams |
| [Setup.md](Setup.md) | Environment setup for Windows and macOS, deployment, troubleshooting |
| [Human_Tasks.md](Human_Tasks.md) | Actions that need a person (credentials, accounts, approvals) |
| [Agent_Content.md](Agent_Content.md) | Working context and handoff log for parallel contributors |

## Project structure

```
src/
  app/            routes: (public) site, (auth) login, (app) staff modules, api/v1
  components/     ui primitives, shared building blocks, app shell, feature modules
  lib/            pure business rules: GST, subsidy, warranty, state machines, validation
  server/         models, auth, services (business logic), server actions
scripts/          local MongoDB, demo data seeder (history + live pipeline), flow smoke checks
tests/            Vitest unit tests (domain rules, form schemas, packing gate)
engineering/      technical documentation
product/          product documentation
```

## Team

| Member | GitHub | Owns |
|---|---|---|
| Hanvith Sai Alla | [@hanvithSai](https://github.com/hanvithSai) | Product, architecture, frontend |
| Lagishetty Vamshi | [@LV2402](https://github.com/LV2402) | Backend, database, integrations, tests |
