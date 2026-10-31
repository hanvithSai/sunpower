# SunPower OS: Analytics Plan

| | |
|---|---|
| **Version** | 1.2, 1 Nov 2026 (cookie consent, masked click capture, CTAs, heatmaps, web vitals) |
| **Tool** | PostHog Cloud, free tier: product analytics, web analytics, session replay, heatmaps, web vitals, exception autocapture |
| **Owners** | Hanvith Sai Alla (client events, dashboards) · Lagishetty Vamshi (server events in services) |
| **Related** | [PRD.md](PRD.md) (success metrics) · [Features.md](Features.md) (where each event fires) |

## 1. Principles

1. **Measure outcomes, not clicks.** Every event maps to a lifecycle step or a KPI.
2. **MongoDB is the system of record** for money, stages and cycle times. PostHog shows behaviour, adoption, funnels and errors. When the two disagree, MongoDB wins, and PostHog figures are never used for accounting.
3. **Privacy by default.** Browser analytics only with consent, and no customer phone numbers or emails in events (section 3).
4. **The taxonomy is a contract.** Code and dashboards use the exact event and property names in section 6.

## 2. Setup

| Item | Decision |
|---|---|
| Plan | PostHog Cloud free tier (1 million events and 5,000 session recordings a month at the time of writing). About 20 staff users and 40 installations a month need only a few thousand events a month. |
| Consent | **Opt-in.** PostHog is not started until the visitor clicks *Accept analytics* in the cookie banner, so before that nothing is stored on the device and nothing is sent to PostHog. See section 3 |
| Client SDK | `posthog-js`, configured in `src/lib/analytics-client.ts` (`startAnalytics`). `src/instrumentation-client.ts` starts it at load when consent was given on an earlier visit, otherwise when the visitor accepts |
| Server SDK | `posthog-node` in the services layer, flushed after the response with Next.js `after()` so tracking never slows an action |
| Pageviews | `$pageview` on every App Router navigation (history change), not only on full page loads |
| Click autocapture | On for clicks and submits on links, buttons and forms, **fully masked** (`mask_all_text`, `mask_all_element_attributes`): no element text and no attributes, so `tel:` and `wa.me` links (they contain phone numbers) never reach PostHog. The one label that survives is `data-ph-capture-attribute-cta`, set by `cta()` in `src/lib/analytics.ts` on the calls to action in section 6 |
| Rage and dead clicks | On, with the same masking. Elements inside `ph-no-capture` are ignored |
| Web vitals | On (`capture_performance: { web_vitals: true, network_timing: false }`): LCP, INP, CLS and FCP per page as `$web_vitals`. Network timing in replays stays off. The page URL inside each metric is scrubbed |
| Heatmaps | On (`capture_heatmaps`): click positions and scroll depth per page, for every visitor, no text. `before_send` scrubs the page URLs the heatmap data is keyed by. Also switch on **Settings → Heatmaps** in PostHog; view them with the PostHog toolbar on the live site |
| Session replay | Staff only, and only with consent. Recording starts after sign-in; all inputs masked; phones, emails and GSTINs masked in all text |
| Exceptions | Client exception autocapture produces `$exception`; server errors are reported from `onRequestError` in `src/instrumentation.ts` |
| Person profiles | `identified_only`, so anonymous public visitors don't create person profiles |
| Environments | `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` should be set only in Vercel Production. Without a key, analytics and the cookie banner are off (local development, CI, previews). Developers can point the key at a test project to check events. Browser events go through our `/ingest` proxy; `NEXT_PUBLIC_POSTHOG_HOST` is used by the server SDK |

## 3. Identity and privacy

- **Staff:** after sign-in the client calls `identify(userId)` with the internal MongoDB user id and sets one person property, `role` (`admin`, `sales`, `technician`, `warehouse`, `support`). No staff names or emails are sent.
- **Sign-out:** `reset()` clears the identity on shared devices.
- **Public visitors:** anonymous, never identified, never recorded, and counted only if they accept analytics cookies.
- **Server events:** `distinct_id` is the acting user's id. System events (public form, scheduled quote expiry) use `system` with `$process_person_profile: false`.

**Privacy rules (non-negotiable)**

1. No customer phone numbers or email addresses in any event property, person property or URL. Also excluded: customer names, addresses, GSTINs, service connection numbers, serial numbers, free-text notes, search text, photos and signatures.
2. Users are identified only by internal user id and role.
3. Session replay masks every input. Elements that display customer contact data (contact cards, addresses, the signature pad) carry the `ph-no-capture` class.
4. URLs carry ids, never personal data. Warranty lookup is a POST. `before_send` rewrites `/share/<token>` to `/share/:token` and drops unknown query parameters, in event properties, replay metadata and heatmap page keys, so share tokens and search text never reach PostHog.
7. Click capture is masked: no element text, no attributes, no link URLs. CTAs are labelled only by a fixed name from `CTAS`.
5. Money appears only as whole-rupee business amounts (`totalRs`, `amountRs`).
6. Do Not Track and Global Privacy Control are respected as a rejection until the visitor explicitly accepts.

**Cookie consent**

| Rule | How it works |
|---|---|
| Opt-in, not opt-out | Analytics cookies are off until the visitor clicks *Accept analytics*. PostHog isn't initialised before that: no cookies, no storage, no requests |
| A fair choice | *Accept analytics* and *Reject analytics* are the same size and style; nothing is pre-ticked; the page stays usable behind the banner; no "accept by continuing" |
| Informed | The banner says what analytics does (including staff screen recordings with personal details hidden) and links to `/privacy`, which lists every cookie and storage item, the processors and their locations, retention and rights |
| Browser signals | Global Privacy Control and Do Not Track count as *Reject*, and no banner is shown. An explicit *Accept* later (from Cookie settings) overrides them |
| Easy to withdraw | "Cookie settings" in the public footer, on `/privacy` and in the staff account menu reopen the banner. Withdrawing stops PostHog, forgets the identity and deletes every `ph_…` cookie and storage item |
| Recorded and renewed | The choice is one essential item, `sunpower_consent` (`{v, analytics, at}`). It lasts 12 months, and raising `CONSENT_VERSION` in `src/lib/consent.ts` asks everyone again |
| Not covered by the banner | Essential cookies (the staff session and sign-in protection) and server-side events, which carry no cookies and no personal data |

These rules keep personal data in analytics to the minimum, in line with India's Digital Personal Data Protection Act 2023 (notice, consent as easy to withdraw as to give, rights and grievance contact on `/privacy`) and the opt-in standard of the EU GDPR and ePrivacy rules.

## 4. North-star metric

**Installations commissioned per month:** installation jobs completed with the customer's signature in the calendar month (IST).

- **Why:** it is the moment the customer receives value and SunPower earns its revenue, and it only grows when every upstream stage works: first response, survey, quote, payment, dispatch and crew scheduling.
- **Source:** MongoDB job completion time; PostHog proxy: monthly count of `job_completed`.
- **Baseline and target:** about 40 a month today; 48 a month within 6 months with the same 15 technicians.
- **Guardrails:** average gross margin per job at least 15%, and no ticket open longer than 7 days. Growth must not come from cutting corners.

## 5. KPIs

| KPI | Definition | Source | Target |
|---|---|---|---|
| Lead → order conversion | Leads created in a month whose order is confirmed within 60 days ÷ leads created that month | MongoDB; PostHog proxy `order_confirmed` ÷ `lead_created` | ≥ 20% |
| Lead first-response time | Median time from lead creation to the first "Reached" contact | MongoDB; PostHog `lead_status_changed` from `new` | Median ≤ 30 min; 95% within 2 h |
| Survey → quote time | Median time from survey submitted to first quote sent for that lead | MongoDB | ≤ 24 h |
| Quote acceptance rate | Leads with an accepted quote ÷ leads with a sent quote, monthly | MongoDB; PostHog proxy `quote_accepted` ÷ `quote_sent` (counts versions) | ≥ 50% |
| Dispatch accuracy | Completed jobs whose kit check says all items were received ÷ completed jobs | MongoDB (job kit check) | 100% |
| Days order → commissioned | Median days from order confirmed to job completed | MongoDB | ≤ 7 days |
| Open tickets | Tickets not Closed, with age bands (0–3, 4–7, over 7 days) | MongoDB; PostHog `ticket_created` vs `ticket_closed` | Under 15 open; none over 7 days |
| Warranty claim rate | In-warranty tickets ÷ serial units under warranty, trailing 12 months, by brand and model | MongoDB | Under 2% |
| Gross margin per job | (Revenue excl. GST − material − labour − extras) ÷ revenue | MongoDB (F14 costing) | ≥ 15% average; no loss-making jobs |
| DSO (days sales outstanding) | Receivables outstanding ÷ invoiced revenue of the last 90 days × 90 | MongoDB (invoices and payments) | ≤ 15 days |

Money and cycle-time KPIs appear on the in-app dashboard (F15), computed from MongoDB. PostHog shows the event-based proxies and the behaviour behind them.

## 6. Event taxonomy

**Conventions:** event names are `object_action` in snake_case and past tense; properties are camelCase; enum values are lowercase snake_case and mirror the Zod enums in `src/lib/schemas`; money is whole rupees (`…Rs`, while the database stores paise); durations carry their unit in the name. Business events fire on the server after the database change commits; UI events fire in the browser. Properties listed here are the complete set: nothing else is attached apart from PostHog's own `$` properties.

| Event | Properties | Fired when | From | Feature |
|---|---|---|---|---|
| `enquiry_submitted` | `source` (string: `web`, or the `?source=` campaign value), `capacityKw` (number 1–5, or null for "not sure"), `systemType` (`on_grid`, `off_grid`, `not_sure`) | The server accepts a public enquiry | Client | F03 |
| `lead_created` | `source` (`web`, `whatsapp`, `call`, `walk_in`, `referral`) | A lead is saved, from the public form or manual entry | Server | F03, F04 |
| `lead_status_changed` | `from`, `to` (`new`, `contacted`, `qualified`, `survey`, `quoted`, `won`, `rejected`, `lost`) | Any lead status transition | Server | F04, F05 |
| `survey_scheduled` | none | A survey is assigned to a technician and date | Server | F06 |
| `survey_completed` | none | The technician submits the survey | Server | F06 |
| `survey_reviewed` | `decision` (`approved`, `rejected`) | Sales or admin reviews a submitted survey | Server | F06 |
| `quote_created` | `packageCode` (string, for example `ONGRID-3KW`), `capacityKw` (number), `totalRs` (integer, grand total including GST, before subsidy) | A quote or a new quote version is first saved | Server | F08 |
| `quote_sent` | none | A quote version is marked sent | Server | F08 |
| `quote_accepted` | none | The customer's acceptance is recorded and the order is created | Server | F08, F09 |
| `payment_recorded` | `type` (`advance`, `balance`, `full`), `mode` (`upi`, `neft`, `cash`, `cheque`), `amountRs` (integer) | A payment is saved | Server | F09 |
| `order_confirmed` | none | The first payment confirms the order; pick list and job created | Server | F09 |
| `grn_received` | `lines` (integer, product lines), `units` (integer, total quantity) | A goods received note is saved | Server | F10 |
| `serial_scanned` | `method` (`camera`, `manual`) | The server accepts a scan onto a pick list (rejected scans are not sent) | Client | F11 |
| `order_dispatched` | none | Dispatch succeeds after every serial is scanned | Server | F11 |
| `order_delivered` | `warrantiesStarted` (integer) | The order is marked delivered and warranties are created | Server | F11 |
| `job_started` | none | The technician taps Start on an installation job | Server | F12 |
| `job_completed` | `durationHours` (number, 1 decimal place) | The job is completed with the customer's signature | Server | F12 |
| `ticket_created` | `warrantyState` (`in_warranty`, `out_of_warranty`, `not_applicable`), `category` (`inverter_fault`, `no_generation`, `low_generation`, `battery`, `wiring_earthing`, `panel_damage`, `net_meter`, `other`) | A service ticket is saved | Server | F13 |
| `ticket_resolved` | `resolutionType` (`repair`, `replacement`, `remote_fix`, `no_fault_found`), `billable` (boolean) | A ticket moves to Resolved | Server | F13 |
| `ticket_closed` | none | A ticket is closed after the customer confirms | Server | F13 |
| `invoice_issued` | `type` (`order`, `service`) | An invoice is issued by hand or automatically | Server | F14 |
| `share_link_created` | none | The director creates a read-only share link | Server | F17 |
| `report_exported` | `report` (`invoices`, `tickets`), `rows` (integer) | An invoice or ticket CSV is generated | Server | F17 |
| `search_performed` | `resultCount` (integer) | A search settles (300 ms after typing stops, at least 2 characters); the query text is never sent | Client | F02, F13 |
| `search_result_opened` | `type` (`customer`, `serial`, `order`, `ticket`, `lead`, `quote`, `invoice`) | A search result is opened | Client | F13 |
| `warranty_lookup` | `by` (`serial`, `phone`), `found` (boolean) | A public warranty check is answered (the serial and phone are never sent) | Server | F20 |
| `certificate_shared` | none | A customer certificate link is created from the job page | Server | F22 |
| `$pageview` | Automatic (URL sanitised by `before_send`) | Every route change | Client | All |
| `$autocapture` | Automatic, masked; `cta` when the element is a tagged call to action: `hero_get_quote`, `hero_staff_sign_in`, `nav_get_quote`, `nav_warranty`, `nav_staff_login`, `footer_call`, `footer_get_quote`, `footer_warranty`, `footer_staff_login`, `enquiry_submit`, `warranty_submit`, `warranty_call`, `warranty_whatsapp`, `certificate_whatsapp` | A click on a link or button, or a form submit | Client | F01, F20, F22 |
| `$rageclick`, `$dead_click` | Automatic, masked | Repeated clicks on one spot; a click that changed nothing | Client | All |
| `$$heatmap` | Automatic (page URLs scrubbed) | Batched click and scroll positions | Client | All |
| `$web_vitals` | Automatic: `$web_vitals_LCP_value`, `…_INP_value`, `…_CLS_value`, `…_FCP_value` (URLs scrubbed) | Page load and interaction speed, once per page | Client | All |
| `$exception` | Automatic (type, message, stack) | An unhandled client error; server errors via `onRequestError` | Client, Server | All |

## 7. Funnels

PostHog funnels follow one person. Steps done by different roles (for example sales then warehouse) are measured from MongoDB stage timestamps instead; PostHog group analytics is a paid add-on and is not used.

| Funnel | Steps | Window | Breakdown | Question it answers |
|---|---|---|---|---|
| Public enquiry | `$pageview` on `/` → `$autocapture` with `cta` = `hero_get_quote` or `nav_get_quote` → `$pageview` on `/enquiry` → `$autocapture` with `cta` = `enquiry_submit` | 1 day | Device type, `cta` | Does the landing page turn visitors into enquiries, and which button brings them? |
| Warranty self-service | `$pageview` on `/warranty` → `$autocapture` with `cta` = `warranty_submit` → `$autocapture` with `cta` = `warranty_call` or `warranty_whatsapp` | 1 day | Device type | Do homeowners answer their own question, or still need to call? |
| Quote to cash (sales) | `quote_created` → `quote_sent` → `quote_accepted` → `payment_recorded` | 30 days | `packageCode` | Where do deals stall? |
| Dispatch (warehouse) | `$pageview` on `/dispatch/[orderId]` → `serial_scanned` → `order_dispatched` → `order_delivered` | 1 day | `method` | Does scanning slow or block dispatch? |
| Installation (technician) | `job_started` → `job_completed` | 12 hours | Device type | Do technicians finish jobs in the app? |
| Support lookup | `search_performed` → `search_result_opened` → `ticket_created` | 10 minutes | `type` | Does search find the right record during the call? |
| Lifecycle (business) | Enquiry → Qualified → Survey approved → Quote sent → Order confirmed → Delivered → Commissioned | Monthly cohorts | Source, city, package | Where does the business lose customers? |

The lifecycle funnel is computed from MongoDB. Its PostHog proxy is a trend of monthly counts of `lead_created`, `quote_sent`, `quote_accepted`, `order_confirmed`, `order_delivered` and `job_completed`.

Public funnels use browser events only: `enquiry_submitted` and `warranty_lookup` are sent by the server under `system` (visitors are anonymous), so they can't join a visitor's funnel. Count them as trends next to the funnel; `warranty_lookup` by `found` gives the self-service answer rate.

**CTR of a call to action** = `$autocapture` where `cta` = X ÷ `$pageview` of the page it sits on, as a Trends formula (for example `hero_get_quote` clicks ÷ `/` pageviews, daily).

## 8. Dashboards

| PostHog dashboard | Audience and cadence | Insights |
|---|---|---|
| Business pulse | Director, weekly | Installations per month (`job_completed`); leads by `source`; quote acceptance (`quote_accepted` ÷ `quote_sent`); cash recorded (sum of `amountRs` by `mode`); quoted value (sum of `totalRs`); warranties started (sum of `warrantiesStarted`) |
| Sales | Sales, daily | Enquiries by `systemType` and `capacityKw`; lead transitions (`lead_status_changed` by `to`); public enquiry and quote-to-cash funnels; package mix (`quote_created` by `packageCode`) |
| Operations | Warehouse and director, weekly | Units received (sum of `units`); scans by `method`; dispatched vs delivered per week; job duration median and 90th percentile (`durationHours`); dispatch and installation funnels |
| Service | Support and director, daily | Tickets by `warrantyState` and `category`; resolutions by `resolutionType` and `billable`; tickets created vs closed per week; search success and zero-result rate; invoices by `type` |
| Product health | Developers, daily during the event | Weekly active users by `role`; pageviews by route; `$exception` by route and browser; session replays with exceptions; Core Web Vitals (p75 LCP, INP, CLS by route and device); rage and dead clicks; share links and exports |

The in-app director dashboard (F15) stays the place for exact money figures: revenue, cash, profit per job, open repairs, stuck projects and the subsidy pipeline.

## 9. Product health metrics

| Metric | Definition | Target |
|---|---|---|
| Weekly active staff | Users with at least one event in the week, by `role` | Every active user, every week |
| Search success | `search_result_opened` ÷ `search_performed` | ≥ 70% |
| Zero-result searches | `search_performed` with `resultCount` = 0 ÷ all searches | Under 10% |
| Camera scan share | `serial_scanned` with `method` = `camera` ÷ all scans | ≥ 80% |
| Enquiry form conversion | `$pageview` on `/enquiry` → `enquiry_submitted` | ≥ 30% |
| Error rate | `$exception` per 1,000 `$pageview` | Under 2 |
| Billed service share | `ticket_resolved` with `billable` = true ÷ all resolved | Tracked, no target |

## 10. Quality and governance

- **Contract first:** a new or changed event is added to section 6 before the code. A single typed helper maps each event name to its properties, so a typo fails the TypeScript check.
- **Release check:** run the golden path on production and confirm that each of the 25 custom events arrives with the expected properties and no personal data.
- **Changes:** never reuse an event name with a new meaning; rename by adding the new event and retiring the old one in this document.
- **Ownership:** Hanvith owns client events and dashboards; Vamshi owns server events in services; either can review.
- **Retention and deletion:** data is kept for the PostHog plan's retention period; a staff member's analytics data can be deleted on request through their user id.
