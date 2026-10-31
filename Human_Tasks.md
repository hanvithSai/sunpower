# Human_Tasks.md

Tasks that need a person: account access, credentials, payments, approvals.
Agents add rows here when they are blocked. Humans tick them off and note the outcome.

**Status:** ✅ done · ⏳ waiting on someone · ❌ blocked / failed · ⬜ not started

| # | Task | Owner | Status | Details |
|---|---|---|---|---|
| 1 | Add evaluators `gppa-odoo` and `hackathon-odoo` as GitHub collaborators | Hanvith | ✅ | Done 31 Oct, before the 11:00 AM deadline. |
| 2 | Provide a MongoDB Atlas cluster | Vamshi | ✅ | Cluster `sunpower.7geox7z.mongodb.net` received. |
| 3 | Fix the Atlas database user credentials | Vamshi | ✅ | Password reset 31 Oct; connection verified and 20 staff accounts seeded. |
| 4 | Allow Vercel to reach Atlas | Vamshi | ✅ | Verified 31 Oct: production `/api/v1/health` reports `db: up`. Vercel's free tier has no fixed IPs, so Network Access must keep allowing them (`0.0.0.0/0`); access stays protected by the DB user's password. |
| 5 | Rotate the Atlas password after the event | Vamshi | ⬜ | The current password was shared in chat and is short. Use 16+ random characters. |
| 6 | Make Vercel build the app from GitHub | Hanvith | ✅ | Connected 31 Oct; production runs `main` (health `version` = latest commit). The first deploy failed sign-in because the `MONGODB_URI` credentials in Vercel were rejected; fixed by updating the variable and redeploying. Checklist for future changes: Setup.md §8. |
| 7 | Point the Namecheap domain at Vercel | Hanvith | ✅ | `www.sunpowersolutions.me` is served by Vercel and the apex `sunpowersolutions.me` redirects to `www`. |
| 8 | Create the PostHog project | Hanvith | ⬜ | posthog.com (free tier, US cloud) → new project → copy the *Project API key* into `NEXT_PUBLIC_POSTHOG_KEY` (Vercel + `.env.local`). Analytics stay off until then. |
| 9 | Confirm company details for quotes and invoices | Hanvith | ⬜ | Legal name, GSTIN, registered address, phone, email, bank/UPI details and logo approval. Placeholders live in `src/lib/constants.ts → COMPANY`. |
| 10 | Protect the `main` branch | Hanvith | ⬜ | GitHub → Settings → Branches → add a rule for `main`: require a pull request + the **CI** status check. |
| 11 | Review the backend foundation before the demo | Vamshi | ⬜ | Walk through `src/server/**` (models, auth, services) and `engineering/DB.md`, so you can answer judges' questions on the parts you own. |
| 12 | Record and submit the demo video | Hanvith | ⬜ | Due **01 Nov, 10:30 AM**. Follow the demo script in `Plan.md §9`. |
| 13 | Plan for the slow venue network during demos | Both | ⬜ | Venue Wi-Fi takes 2–7 s per DNS lookup and 10–60 s for a cold Atlas connection. Demo from the deployed Vercel URL (Vercel ↔ Atlas is fast), or keep a phone hotspot ready for local runs. |
| 14 | Decide the Vercel function region | Hanvith | ✅ | Approved 31 Oct: functions pinned to Mumbai (`bom1`) via `vercel.json`; confirm with `region` in `/api/v1/health`. |
