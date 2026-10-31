# Setup.md: Run SunPower OS locally and in production

This guide covers a fresh **Windows 10/11** or **macOS** machine, for a human or an AI agent.
Allow about 15 minutes the first time.

---

## 1. What you need

| Tool | Version | Why |
|---|---|---|
| Node.js | **22 LTS** (≥ 20.9 works) | Runs Next.js 16 |
| npm | ships with Node (10+) | Package manager (`package-lock.json` is committed) |
| Git | 2.40+ | Version control |
| A MongoDB database | Atlas free tier (M0) **or** the built-in local DB | Data store |
| A code editor | VS Code recommended | ESLint + Tailwind IntelliSense extensions help |

Optional: a free PostHog account (analytics), a Vercel account (hosting), a Namecheap domain.

---

## 2. Install the tools

### Windows

1. **Git**: install from <https://git-scm.com/download/win> (defaults are fine; keep "Git Bash"). Check in a new terminal with `git --version`.
2. **Node.js 22 LTS** (pick one):
   - Easiest: the Windows installer (LTS) from <https://nodejs.org>.
   - Version manager: install **nvm-windows** from <https://github.com/coreybutler/nvm-windows/releases>, then run `nvm install 22` and `nvm use 22`.
3. Verify in **PowerShell** or **Git Bash**:
   ```powershell
   node -v   # v22.x
   npm -v    # 10.x
   ```
4. If PowerShell blocks `npm` scripts with "running scripts is disabled", run this once:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
5. Tip: if the path has spaces, quote it, e.g. `cd "H:\H Space\...\sunpower"`. Avoid OneDrive-synced folders for `node_modules` if possible, because syncing slows installs.

### macOS

1. **Xcode command line tools** (provides Git): `xcode-select --install`
2. **Homebrew** (if missing): see <https://brew.sh>
3. **Node.js 22 LTS** (pick one):
   ```bash
   brew install node@22 && brew link --overwrite node@22
   # or with nvm:
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   nvm install 22 && nvm use 22
   ```
4. Verify: `node -v` (v22.x), `npm -v`, `git --version`.

---

## 3. Get the code

```bash
git clone https://github.com/hanvithSai/sunpower.git
cd sunpower
npm install
```

The first `npm install` takes 1–3 minutes.

---

## 4. Configure environment variables

Copy the template and fill it in.

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Git Bash:**
```bash
cp .env.example .env.local
```

Open `.env.local` and set:

| Variable | Required | Value |
|---|---|---|
| `MONGODB_URI` | yes | Atlas: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/sunpower?retryWrites=true&w=majority`. Local: `mongodb://127.0.0.1:27017/sunpower?directConnection=true` |
| `AUTH_SECRET` | yes | A random 32+ byte string. Generate with `npx auth secret`, or `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` (works on Windows and macOS) |
| `NEXT_PUBLIC_POSTHOG_KEY` | no | PostHog project API key. Analytics are disabled when empty |
| `NEXT_PUBLIC_POSTHOG_HOST` | no | `https://us.i.posthog.com` |

`.env.local` is git-ignored, so never commit real credentials.

---

## 5. Choose a database

### Option A: MongoDB Atlas (recommended, same as production)

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access** → *Add New Database User* → username + password, role *Read and write to any database*.
   If the password contains `@ : / ? #`, URL-encode those characters in the URI.
3. **Network Access** → *Add IP Address* → your current IP (local dev) **and** `0.0.0.0/0` (needed for Vercel).
4. **Connect → Drivers** → copy the `mongodb+srv://` string, add `/sunpower` before the `?`, and paste it into `MONGODB_URI`.
5. Check the connection:
   ```bash
   npm run seed -- --yes
   ```
   You should see a table of accounts per role. `bad auth` means the user or password is wrong (step 2). A timeout means the IP isn't allowed (step 3).

### Option B: Local database, offline-friendly, no account needed

```bash
npm run db:local
```

This starts an in-memory MongoDB replica set on `127.0.0.1:27017` (transactions supported). Keep that terminal open and use the local `MONGODB_URI` from the table above.

- The first run downloads the MongoDB binary (~780 MB, cached in your home folder afterwards).
- Data lives in memory, so run `npm run seed` again after each restart.

---

## 6. Seed demo data

```bash
npm run seed            # local database
npm run seed -- --yes   # remote database (Atlas) — explicit confirmation required
```

Demo logins (password **`SunPower@2026`** for all):

| Role | Email | Lands on |
|---|---|---|
| Director (admin) | `director@sunpower.demo` | Dashboard |
| Sales | `sales@sunpower.demo` | Leads |
| Technician | `tech@sunpower.demo` | My work |
| Warehouse | `warehouse@sunpower.demo` | Dispatch |
| Support | `support@sunpower.demo` | Service tickets |

> The seed currently creates the staff accounts and the catalog (30 products, 10 packages and opening stock). It never deletes data and is safe to re-run. The full demo history (customers, orders, serials, tickets) arrives with the Phase 3 seed (see `Plan.md`).

---

## 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. Staff sign in at <http://localhost:3000/login>.
Health check: <http://localhost:3000/api/v1/health> returns `{"status":"ok","db":"up"}`.

### Quality checks (the same ones CI runs)

```bash
npm run lint        # ESLint (Next.js + TypeScript rules)
npm run typecheck   # next typegen + tsc --noEmit
npm test            # Vitest
npm run build       # production build
```

### Flow smoke checks (real database)

```bash
npx tsx scripts/check-lead-flow.ts SP-L-0123   # enquiry → qualified → survey → approval gate (10 checks)
npx tsx scripts/check-sale-flow.ts SP-L-0123   # quote → order → payment → pick list + installation job (15 checks)
```

These move the given lead through the pipeline, so use a fresh enquiry (submit `/enquiry` first) on a development database.

---

## 8. Deploy (Vercel + Namecheap)

Production: **https://www.sunpowersolutions.me** (Namecheap domain; the apex redirects to `www`). Vercel URL: **https://sunpowersolutions.vercel.app**

1. Push to GitHub (`main` is production). `vercel.json` pins the framework to Next.js.
2. On <https://vercel.com>: **Add New → Project** → import `hanvithSai/sunpower`. Vercel detects Next.js automatically.
3. **Environment Variables:** add `MONGODB_URI`, `AUTH_SECRET` (use a *different* secret from local), `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`, then **Deploy**.
4. Make sure Atlas **Network Access** includes `0.0.0.0/0`.
   - Paste env values without quotes or spaces, and never leave Atlas's `<db_password>` placeholder in the string.
   - Env changes only reach **new** deployments: after editing, go to **Deployments → ⋯ → Redeploy**.
   - Verify: `https://www.sunpowersolutions.me/api/v1/health` must show `"db":"up"`, the expected `version` (Git commit) and `region` `bom1`. If `db` is down, the `reason` field says why.
5. **Custom domain:** Vercel → Project → Settings → **Domains** → add `yourdomain.tld` and `www.yourdomain.tld`. Then in Namecheap → Domain List → **Manage → Advanced DNS** add:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`

   Use the exact values Vercel displays. DNS usually propagates within 5–30 minutes, and HTTPS is issued automatically.
6. Every pull request gets a preview URL. The **CI** GitHub Action (lint, typecheck, test, build) must pass before merging.

---

## 9. Team workflow (2 developers)

```bash
git checkout main && git pull
git checkout -b feat/<area>-<short-name>    # e.g. feat/quotes-ui
# ... work, commit small and often ...
git push -u origin feat/<area>-<short-name> # open a PR, the other developer reviews
```

- Ownership by folder avoids merge conflicts. See `Plan.md §7` and `.github/CODEOWNERS`.
- Commit identities and message styles:
  - Hanvith: `Hanvith Sai Alla <hanvithsai.a@gmail.com>`, 6–8 words in the past tense ("Added quote builder with automatic BOM").
  - Vamshi: `Lagishetty Vamshi <vamshi.lagishetty24@gmail.com>`, 3–4 simple words ("add quote service").
- Before every commit, update `Plan.md` (status), `Agent_Content.md` (session log) and any affected docs.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `MONGODB_URI is not set` | `.env.local` missing or in the wrong folder. It must sit next to `package.json` |
| `bad auth : authentication failed` | Wrong Atlas user/password. Reset it in Atlas → Database Access (and URL-encode special characters) |
| `Server selection timed out` / "IP that isn't whitelisted" | Your IP isn't in Atlas → Network Access, the local DB isn't running, **or the network is very slow**. On venue Wi-Fi, SRV DNS lookups can take 5–15 s: retry once, switch to a phone hotspot, or use Atlas's standard string (Connect → Drivers → pick an older driver version) in `.env.local`: `mongodb://USER:PASS@host-00:27017,host-01:27017,host-02:27017/sunpower?tls=true&replicaSet=<set>&authSource=admin` |
| `MissingSecret` / login loops | `AUTH_SECRET` is empty. Generate one (section 4) and restart `npm run dev` |
| Port 3000 in use | `npm run dev -- -p 3001` |
| PowerShell won't run npm scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `db:local` is slow the first time | It is downloading MongoDB (~780 MB) once. Atlas avoids this |
| Type errors about `PageProps`/`LayoutProps` | Run `npx next typegen` (or `npm run dev` once) to generate route types |
| Live site shows Vercel `NOT_FOUND` | Vercel has no build of the app: connect the Git repo, set Framework Preset to Next.js, add the env vars and redeploy (Human_Tasks #6) |
| Sign-in shows "We couldn't sign you in right now" | The app can't reach MongoDB in that environment. Open `/api/v1/health`: its `reason` names the problem (`auth_failed` = wrong credentials in `MONGODB_URI`, `uri_invalid` = quotes or placeholders, `uri_missing`, `dns` = mistyped host, `timeout` = Atlas Network Access). Fix the variable, then redeploy |
| Pages feel slow from India | Functions are pinned to Mumbai (`bom1`) in `vercel.json`; `/api/v1/health` shows the live `region`. If it isn't `bom1`, check that `vercel.json` is on the deployed commit and that no dashboard override is set (Project → Settings → Functions) |
