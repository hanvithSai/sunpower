# Human_Tasks.md

Tasks that need a person: account access, credentials, payments, approvals.
Agents add rows here when they are blocked. Humans tick them off and note the outcome.

**Status:** ✅ done · ⏳ waiting on someone · ❌ blocked / failed · ⬜ not started

| # | Task | Owner | Status | Details |
|---|---|---|---|---|
| 1 | Add evaluators `gppa-odoo` and `hackathon-odoo` as GitHub collaborators | Hanvith | ✅ | Done 31 Oct, before the 11:00 AM deadline. |
| 2 | Provide a MongoDB Atlas cluster | Vamshi | ✅ | Cluster `sunpower.7geox7z.mongodb.net` received. |
| 3 | Fix the Atlas database user credentials | Vamshi | ✅ | Password reset 31 Oct; connection verified and 20 staff accounts seeded. |
| 4 | Allow Vercel to reach Atlas | Vamshi | ⬜ | Atlas → **Network Access** → *Add IP Address* → `0.0.0.0/0`. Vercel's free tier has no fixed IPs. Access is still protected by the DB user's password. |
| 5 | Rotate the Atlas password after the event | Vamshi | ⬜ | The current password was shared in chat and is short. Use 16+ random characters. |
| 6 | Create the Vercel project | Hanvith | ⬜ | vercel.com → *Add New → Project* → import `hanvithSai/sunpower` (framework auto-detected: Next.js). Add the environment variables `MONGODB_URI`, `AUTH_SECRET` (generate a NEW one with `npx auth secret`), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`, then click Deploy. |
| 7 | Point the Namecheap domain at Vercel | Hanvith | ⏳ | Domain to be shared. Add it in Vercel → Project → **Settings → Domains**. In Namecheap → *Domain List → Manage → Advanced DNS*: `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com` (use the exact values Vercel shows). |
| 8 | Create the PostHog project | Hanvith | ⬜ | posthog.com (free tier, US cloud) → new project → copy the *Project API key* into `NEXT_PUBLIC_POSTHOG_KEY` (Vercel + `.env.local`). Analytics stay off until then. |
| 9 | Confirm company details for quotes and invoices | Hanvith | ⬜ | Legal name, GSTIN, registered address, phone, email, bank/UPI details and logo approval. Placeholders live in `src/lib/constants.ts → COMPANY`. |
| 10 | Protect the `main` branch | Hanvith | ⬜ | GitHub → Settings → Branches → add a rule for `main`: require a pull request + the **CI** status check. |
| 11 | Review the backend foundation before the demo | Vamshi | ⬜ | Walk through `src/server/**` (models, auth, services) and `engineering/DB.md`, so you can answer judges' questions on the parts you own. |
| 12 | Record and submit the demo video | Hanvith | ⬜ | Due **01 Nov, 10:30 AM**. Follow the demo script in `Plan.md §9`. |
| 13 | Plan for the slow venue network during demos | Both | ⬜ | Venue Wi-Fi takes 2–7 s per DNS lookup and 10–60 s for a cold Atlas connection. Demo from the deployed Vercel URL (Vercel ↔ Atlas is fast), or keep a phone hotspot ready for local runs. |
