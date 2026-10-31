# SunPower OS

**The digital backbone for a rooftop-solar company. One platform from the first enquiry to the 20-year warranty.**

[![CI](https://github.com/hanvithSai/sunpower/actions/workflows/ci.yml/badge.svg)](https://github.com/hanvithSai/sunpower/actions/workflows/ci.yml)

Built for **SunPower Solutions** (Telangana) at the Odoo x GCET Hackathon 2026 (Team 19). The company installs about 40 rooftop systems a month with 15 technicians. Today enquiries get lost on WhatsApp, quotes miss parts, serial numbers live on paper, and nobody knows which jobs made money. SunPower OS replaces that with one connected flow:

```
Enquiry → Qualification → Site survey → Quote (auto BOM) → Order & payment → Dispatch (serial scan)
        → Delivery (warranty starts) → Installation (photos + signature) → Service tickets → Month-end P&L
```

## Highlights

- **Enquiries never vanish:** web, WhatsApp, call and walk-in leads land in one pipeline with a 2-hour response SLA.
- **Process gates:** no quote before survey approval, no dispatch until every serial is scanned, no ticket closed until the customer confirms.
- **Kit that's always right:** 1–5 kW On-Grid/Off-Grid templates expand into the full bill of materials, with GST (CGST/SGST) and the PM Surya Ghar subsidy calculated automatically.
- **Automations:** a payment creates the pick list and the crew's job; delivery starts every warranty clock and issues the GST invoice.
- **Support in seconds:** ⌘K search by phone, name or serial, with live warranty status. Out-of-warranty repairs are billed automatically.
- **Director's view:** today/week/month KPIs, profit per job, open repairs, unfinished work and a shareable read-only link.

## Tech stack

Next.js 16 (App Router, Cache Components) · TypeScript · MongoDB Atlas + Mongoose · Auth.js v5 · Tailwind CSS v4 + Radix · Zod · PostHog · Vercel · GitHub Actions. Everything is open source or free tier.

## Quick start

```bash
git clone https://github.com/hanvithSai/sunpower.git && cd sunpower
npm install
cp .env.example .env.local      # set MONGODB_URI and AUTH_SECRET
npm run seed -- --yes           # staff accounts (+ demo data as modules ship)
npm run dev                     # http://localhost:3000
```

The full Windows and macOS guide is in [Setup.md](Setup.md). No Atlas yet? Run `npm run db:local` for an in-memory MongoDB.

Demo logins (password `SunPower@2026`): `director@`, `sales@`, `tech@`, `warehouse@`, `support@` with the domain `sunpower.demo`.

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
scripts/          local MongoDB, demo data seeder
engineering/      technical documentation
product/          product documentation
```

## Team

| Member | GitHub | Owns |
|---|---|---|
| Hanvith Sai Alla | [@hanvithSai](https://github.com/hanvithSai) | Product, architecture, frontend |
| Lagishetty Vamshi | [@LV2402](https://github.com/LV2402) | Backend, database, integrations, tests |
