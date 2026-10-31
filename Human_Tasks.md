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
| 6 | **Make Vercel build the app from GitHub** | Hanvith | 🟨 | The project and domains exist, but https://www.sunpowersolutions.me and https://sunpowersolutions.vercel.app return Vercel's `NOT_FOUND`, and GitHub shows no Vercel deployment for `main`. In Vercel → Project → **Settings**: (1) **Git** → connect `hanvithSai/sunpower`, production branch `main`. If the repo isn't listed, grant the Vercel GitHub App access under GitHub → Settings → Applications → Vercel → Repository access. (2) **Build & Deployment** → Framework Preset **Next.js**. `vercel.json` now pins this too; the preset shows "Other" if the project was created while the repo only had a README. (3) **Environment Variables** (Production + Preview): `MONGODB_URI` = the `mongodb+srv://…/sunpower?retryWrites=true&w=majority` string, `AUTH_SECRET` = a NEW value from `npx auth secret`, optional `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SITE_URL=https://www.sunpowersolutions.me`. (4) **Deployments → Redeploy** the latest `main`. Check that https://www.sunpowersolutions.me/api/v1/health shows `"db":"up"`. |
| 7 | Point the Namecheap domain at Vercel | Hanvith | ✅ | `www.sunpowersolutions.me` is served by Vercel and the apex `sunpowersolutions.me` redirects to `www`. |
| 8 | Create the PostHog project | Hanvith | ⬜ | posthog.com (free tier, US cloud) → new project → copy the *Project API key* into `NEXT_PUBLIC_POSTHOG_KEY` (Vercel + `.env.local`). Analytics stay off until then. |
| 9 | Confirm company details for quotes and invoices | Hanvith | ⬜ | Legal name, GSTIN, registered address, phone, email, bank/UPI details and logo approval. Placeholders live in `src/lib/constants.ts → COMPANY`. |
| 10 | Protect the `main` branch | Hanvith | ⬜ | GitHub → Settings → Branches → add a rule for `main`: require a pull request + the **CI** status check. |
| 11 | Review the backend foundation before the demo | Vamshi | ⬜ | Walk through `src/server/**` (models, auth, services) and `engineering/DB.md`, so you can answer judges' questions on the parts you own. |
| 12 | Record and submit the demo video | Hanvith | ⬜ | Due **01 Nov, 10:30 AM**. Follow the demo script in `Plan.md §9`. |
| 13 | Plan for the slow venue network during demos | Both | ⬜ | Venue Wi-Fi takes 2–7 s per DNS lookup and 10–60 s for a cold Atlas connection. Demo from the deployed Vercel URL (Vercel ↔ Atlas is fast), or keep a phone hotspot ready for local runs. |
