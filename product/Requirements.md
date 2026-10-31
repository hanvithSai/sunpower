# SunPower OS: Requirements Traceability

| | |
|---|---|
| **Version** | 1.0, 31 Oct 2026 |
| **Owner** | Hanvith Sai Alla (product) · acceptance tests run by Lagishetty Vamshi |
| **Sources** | [Solar_Installation_Management_System.md](../Solar_Installation_Management_System.md) (the brief) · [EVENT.md](../EVENT.md) (judging criteria) |
| **Related** | [PRD.md](PRD.md) · [Features.md](Features.md) |

This matrix lists every explicit and implied requirement in the brief, the feature that satisfies it and the test that proves it.

**Legend.** Scene: §1 The challenge · §2 Meet SunPower · S1 The rooftop inquiry · S2 Getting the kit right · S3 Dispatch day and serial numbers · S4 On the roof · S5 The rainy season breakdown · S6 The director's month-end · X cross-cutting. Type: **E** explicit in the brief, **I** implied by it. Priority: P0 must, P1 should, P2 could (PRD section 12).

## 1. Requirements traceability matrix

| ID | Requirement | Source (quote or paraphrase) | Scene | Type | Pri | Features | Acceptance test |
|---|---|---|---|---|---|---|---|
| R-01 | One platform in which every module works on the same customer record | "one unified software platform" | §1 | E | P0 | F02, F19, all | From a ticket, open the same customer's lead, quote, order, serials and invoices without retyping anything |
| R-02 | Cover the customer from first enquiry to the end of the warranty | "from the first quote request to the 20-year warranty" | §1 | E | P0 | F03–F13 | A seeded commissioned project shows its full timeline, and its panel warranties end 20 years after delivery |
| R-03 | Serve homes and small factories | "rooftop projects ... for homes and small factories" | §2 | E | P0 | F03, F04, F14 | The enquiry form offers Home and Business; a business invoice shows the customer GSTIN; business quotes show no subsidy |
| R-04 | Stay fast at about 40 projects a month and months of history | "about 40 rooftop projects a month" | §2 | I | P0 | All, F15 | With the full seed (~150 projects, 14 months) every list and the dashboard load in under 2 s |
| R-05 | Track high-value stock | "keeps high-value stock such as panels, inverters and batteries" | §2 | E | P0 | F10 | `/inventory` shows on-hand, reserved and available quantity and value at cost; a GRN increases on-hand |
| R-06 | Schedule a crew of 15 technicians | "a crew of 15 technicians to customer sites" | §2 | E | P0 | F06, F12, F18 | The crew calendar lists all 15 technicians; booking one twice on the same day shows a warning |
| R-07 | Handle a steady stream of service calls | "an endless stream of service calls follows" | §2 | E | P0 | F13 | `/service` lists open tickets by status and age and filters by technician |
| R-08 | Sell systems from 1 kW to 5 kW, On-Grid and Off-Grid | "from 1 kW to 5 kW, in two kinds: On-Grid ... and Off-Grid" | §2 | E | P0 | F07 | The catalog has 10 system templates (1–5 kW × On-Grid and Off-Grid) plus 5 Panel Set templates |
| R-09 | Packages contain the listed components | Panel set: panels, connectors, wires; On-Grid: inverter, wiring boxes, charge controller, panels, earthing, stands; Off-Grid adds a battery | §2 | E | P0 | F07 | Each template's BOM holds every listed component category; Off-Grid templates include a battery; Panel Set templates hold only panels, MC4 connectors and DC cable and get no subsidy |
| R-10 | Installation is sold as a service | "Installation (Service): fitting and testing by our crew" | §2 | E | P0 | F07, F08 | Every system quote has an installation line taxed at 18% |
| R-11 | Capture enquiries from WhatsApp, calls and the web form | "Arrive on WhatsApp, calls and a web form, and get lost" | §2 | E | P0 | F03, F04 | Leads from web, WhatsApp, call and walk-in appear with their source; no delete action exists |
| R-12 | Online enquiry form with name, phone, address and needs, including subsidy interest | "fills in a form online asking for a 3 kW system under the subsidy" | S1 | E | P0 | F03 | Submitting 3 kW with subsidy "yes" on a 360 px phone shows a reference number |
| R-13 | The enquiry reaches sales immediately | "should land with the sales team straight away" | S1 | E | P0 | F03, F04 (F21) | The enquiry appears in the New column of `/leads` within 30 s with no manual entry |
| R-14 | An enquiry can never vanish | "the enquiry should never vanish" | S1 | E | P0 | F04, F19 | Leads can't be deleted; an uncontacted lead turns red after 2 h; a repeat enquiry from the same mobile joins the open lead |
| R-15 | Qualify by phone: shadow-free roof space, monthly bill, grid suitability | "how much shadow-free roof space ..., what their monthly electricity bill is, and whether the grid connection is suitable" | S1 | E | P0 | F04, F05 | Qualify stays disabled until the three items (and DISCOM) are filled; the values show on the lead |
| R-16 | Turn away unsuitable leads with a reason | "If it looks good, a technician visits" | S1 | I | P0 | F05 | Rejecting without a reason fails validation; the reason appears on the timeline |
| R-17 | Survey records roof direction, tilt and cable distance | "measure the roof direction, tilt and cable distance" | S1 | E | P0 | F06 | Submit is blocked until direction, tilt (0–60°), cable distances and 2 photos are present |
| R-18 | The survey reaches the assigned technician | "a technician visits" | S1 | I | P0 | F06, F12 | An assigned survey appears in that technician's `/my-work` on the scheduled date |
| R-19 | Surveys are reviewed and approved or rejected | "Only after the survey is approved" | S1 | E | P0 | F06 | Sales can approve, or reject with a reason; the decision is on the timeline |
| R-20 | No quote before survey approval | "Only after the survey is approved should the customer receive a quote." | S1 | E | P0 | F06, F08 | "Create quote" is disabled before approval; a direct server call returns `SURVEY_NOT_APPROVED`; after approval it works |
| R-21 | Show the government subsidy on eligible quotes | "a 3 kW system under the subsidy" | S1 | I | P0 | F08 (F16) | A 3 kW residential On-Grid quote shows ₹78,000 expected subsidy; Off-Grid shows none |
| R-22 | Quotes come from ready templates | "The quote should come from a ready template" | S2 | E | P0 | F07, F08 | Choosing "3 kW On-Grid" creates a quote prefilled with every template line |
| R-23 | The parts list follows automatically | "the exact list of parts should follow on its own: panels, inverter, stands, switches, wires and safety parts" | S2 | E | P0 | F07, F08 | The 3 kW On-Grid quote has about 14 lines, including MC4 connectors, earthing, lightning arrestor, ACDB/DCDB, cable and structure |
| R-24 | Nobody has to remember small parts | "Nobody should have to remember every small part." | S2 | E | P0 | F07, F08 | Removing the earthing line shows a "missing component" warning before sending |
| R-25 | GST-correct pricing | India context: equipment 5%, batteries 18%, installation 18%, CGST + SGST | S2 | I | P0 | F07, F08, F14 | Equipment lines split 2.5% + 2.5% and installation 9% + 9%; totals match a hand calculation |
| R-26 | A quote the customer can read and keep | Quote sent to the customer | S2 | I | P0 | F08 | The A4 print view shows GSTIN, HSN, the tax split and ₹ amounts in lakh format |
| R-27 | Record an advance or full payment | "usually pays an advance, or the full amount, before work starts" | S2 | E | P0 | F09 | Recording a ₹50,000 UPI advance with its UTR shows paid ₹50,000 and the balance on the order |
| R-28 | The warehouse learns what to pack | "the warehouse should know what to pack" | S2 | E | P0 | F09, F11 | The first payment creates a pick list with every order line, visible in `/dispatch` |
| R-29 | The crew sees the job without phone calls | "the installation crew should see the job on their schedule, without anyone phoning" | S2 | E | P0 | F09, F12 | The first payment creates a job in the "To schedule" lane; once scheduled it shows in the technician's `/my-work` |
| R-30 | Show money in rupees with Indian grouping | "₹1,50,000 worth of inverters and batteries" | S3 | I | P0 | F02, all | Amounts render as ₹1,50,000, never ₹150,000 |
| R-31 | Inverters, batteries and charge controllers carry serial numbers (panels too, for their 20-year warranty) | "Every inverter, battery and charge controller has its own serial number" | S3 | E | P0 | F07, F10 | These categories are serialized; a GRN needs one unique serial per unit |
| R-32 | Scan every serialized unit before it leaves | "each must be scanned before it leaves the warehouse" | S3 | E | P0 | F11 | With 1 of 8 serials unscanned, Dispatch is disabled and the server returns `DISPATCH_INCOMPLETE` |
| R-33 | Scan by barcode, with a manual fallback | "must be scanned" | S3 | I | P0 | F11 | Camera scanning works in Android Chrome; typing the same serial is accepted |
| R-34 | Reject wrong scans | Implied by "which unit went to which customer" | S3 | I | P0 | F11 | A serial of the wrong product, or one already dispatched, shows a specific error and isn't added |
| R-35 | Know which unit went to which customer | "the company knows exactly which unit went to which customer" | S3 | E | P0 | F10, F11, F13 | Searching a dispatched serial shows the customer, order and delivery date |
| R-36 | Warranty starts by itself at delivery | "The moment a delivery is done, the warranty clock should start by itself for every serial number" | S3 | E | P0 | F11 | Marking delivered on 31 Oct 2026 creates one warranty per serial starting 31 Oct 2026 |
| R-37 | Warranty length per product | "2 years for an inverter or battery, and 20 years for solar panels" | S3 | E | P0 | F07, F11 | The inverter's warranty ends 31 Oct 2028 and a panel's ends 31 Oct 2046 |
| R-38 | No hand-typed warranty dates | "No one should have to type dates into a register." | S3 | E | P0 | F11 | Warranty dates are read-only in the UI and computed only by the server |
| R-39 | A simple job form on a phone or tablet | "open a simple form on their phone or tablet" | S4 | E | P0 | F12 (F23) | A job can be completed at 360 px width with no horizontal scrolling and 44 px targets |
| R-40 | Record start and finish times | "note the start and finish times" | S4 | E | P0 | F12 | Start and Complete store timestamps; a finish before the start is rejected |
| R-41 | Confirm the system size | "confirm the system size" | S4 | E | P0 | F12 | Confirmed kW is required; a value different from the order needs a reason |
| R-42 | Upload photos of the finished roof | "upload photos of the finished roof" | S4 | E | P0 | F12 | Completion is blocked with no photo; uploaded photos are compressed to about 200 KB and shown on the job |
| R-43 | Record that generation was tested | "They test that power is being generated" | S4 | I | P0 | F12 | Complete requires the "generation verified" tick |
| R-44 | The homeowner signs on screen | "The homeowner signs on the screen to accept the work." | S4 | E | P0 | F12 | Completion is blocked with an empty signature; the signature image and signer's name are saved |
| R-45 | Clear proof of the job and of what was installed | "clear proof of the job ... no doubt about what was installed" | S4 | E | P0 | F12 (F22) | The printable certificate lists date, kW, every installed serial with its warranty end date, photos and the signature; the customer's WhatsApp link to it opens without login (F22-lite) |
| R-46 | Capture technician hours | "technician hours ... scattered across notebooks" | S4, S6 | I | P0 | F12 (F18) | Completing a job writes a time log for each crew member |
| R-47 | Record the fault reported | "the inverter is showing a fault code and there is zero power" | S5 | I | P0 | F13 | A ticket requires a description and accepts a fault code |
| R-48 | Find the customer and exact serial within seconds | "find the customer and the exact inverter serial number within seconds" | S5 | E | P0 | F13, F02 | ⌘K with the last 4 digits of a mobile number or serial returns the customer and serial in under 1 s on seed data |
| R-49 | See the warranty status | "see whether it is still under warranty" | S5 | E | P0 | F13 | The warranty card shows "In warranty · N months left" or "Expired", consistent with the dates |
| R-50 | In-warranty repairs cost nothing | "the repair or replacement should cost the customer nothing" | S5 | E | P0 | F13 | A ticket on an in-warranty serial shows ₹0, and resolving it creates no invoice; a wiring ticket with no serial on a project commissioned 2 years ago is in workmanship warranty and also ₹0 (R-70) |
| R-51 | Out-of-warranty parts and labour are billed automatically | "the parts and labour should be billed automatically" | S5 | E | P0 | F13, F14 | Resolving an out-of-warranty ticket with 1 part and 2 h of labour creates an invoice with the right GST |
| R-52 | Track the complaint until the customer confirms | "tracked as a ticket until the customer confirms that everything works" | S5 | E | P0 | F13 | Resolve moves the ticket to Resolved, not Closed; Close is disabled until Customer confirmed is recorded (who, channel, time); "Not fixed" returns the ticket to In progress; the server refuses `resolved → closed` |
| R-53 | Track replacement units | "the repair or replacement" | S5 | I | P0 | F13, F10 | A replacement marks the old serial Replaced and the new one Installed on the same project, with warranty per BR-15 |
| R-54 | Customers can check warranty themselves | Implied by frustrated customers and support load | S5 | I | P1 | F20 | `/warranty` with a valid serial shows the warranty state and no personal data |
| R-55 | Show which installations made or lost money | "which installations made money, which lost money" | S6 | E | P0 | F14, F15 | The profit-per-job table sorts by profit, shows losses in red, and reconciles to revenue minus costs |
| R-56 | Show what is still unfinished | "what is still unfinished?" | S6 | E | P0 | F15 | The dashboard counts and lists customers at each pending step (uncontacted lead, survey to review, quote awaiting reply, paid but not dispatched, delivered but not installed, balance due after commissioning, subsidy not disbursed, ticket awaiting confirmation) and projects with no stage change for 7 days, each with owner |
| R-57 | Bring advances, purchases, hours and pending steps into one system | "Advance payments, stock purchases, technician hours and unfinished steps ... scattered" | S6 | E | P0 | F09, F10, F12, F15 (F18) | Each appears on its own screen and feeds the dashboard: advances held on unfinished orders, stock purchased (GRN value) and technician hours for the period |
| R-58 | Send invoices | "There are also invoices to send" | S6 | E | P0 | F14 | Dispatching an order issues its GST invoice automatically (R-73); service invoices come from tickets; `/invoices` lists every invoice with its status |
| R-59 | Track government subsidy paperwork | "government subsidy paperwork to track" | S6 | E | P0 | F16 | A residential On-Grid order moves from Applied to Subsidy disbursed with dates |
| R-60 | Work out technician pay | "technicians to pay" | S6 | E | P0 | F18 | `/team` shows monthly hours × rate per technician and exports CSV |
| R-61 | View today, this week and this month | "how the company is doing today, this week and this month" | S6 | E | P0 | F15 | Switching the period updates every KPI consistently with database queries |
| R-62 | Show profit per job and open repairs | "the profit on each job and the repairs still open" | S6 | E | P0 | F15 | The open-repairs count and list match the open filter in `/service` |
| R-63 | Share the numbers | "share these numbers when needed" | S6 | E | P0 | F17 | A share link opens a read-only view without login and stops working after expiry; CSV downloads |
| R-64 | Role-based access for five internal roles | Different people own each scene | X | I | P0 | F01 | A technician can't open `/dashboard`, and the server refuses its actions |
| R-65 | An audit trail of who did what | "never vanish", "clear proof" | X | I | P1 | F19 | Every status change shows the actor and time on the timeline |
| R-66 | Work on weak rooftop networks | Phone use on rooftops | X | I | P2 | F23 | An offline draft survives a page reload and submits once back online |
| R-67 | Tell people automatically | "without anyone phoning to tell them" | X | I | P2 | F09, F12 (in-app), `wa.me` links; F21 ✂️ | Sending a quote emails the customer when email is configured |
| R-68 | Let customers see project status | "customers are frustrated" | X | I | P2 | F22 | The tracking link shows the current stage without login |
| R-69 | Protect customer personal data | Customer phone and address handled by many people | X | I | P0 | F01, F17, F20 | No phone or email in analytics events; share and warranty pages mask personal data |
| R-70 | Faults with no serial are covered by our workmanship | "If it is [under warranty], the repair ... should cost the customer nothing"; wiring, earthing and structure faults have no serial | S5 | I | P0 | F13, F07 | A wiring/earthing ticket with no serial on a project commissioned within 60 months shows "Workmanship warranty" and ₹0 |
| R-71 | Warranty repairs count against the installation's profit | "which installations made money, which lost money" over the warranty period | S5, S6 | I | P0 | F13, F14, F15 | Resolving an in-warranty ticket with a ₹3,000-cost part and 2 h of labour lowers that order's profit by ₹3,000 + 2 h × the technician's rate |
| R-72 | Automatic crew booking never double-books a technician | "the installation crew should see the job on their schedule" for a crew of 15 | S2, §2 | I | P0 | F09, F12 | Confirming two orders that land on the same install date gives them disjoint crews, or moves the second job to the next day with 3 free installers |
| R-73 | The sale invoice is issued at dispatch | "invoices to send"; GST requires a goods invoice at or before removal | S3, S6 | I | P0 | F11, F14 | Dispatching an order creates its GST invoice in the same step with payments received applied (BR-18) |

The five pains in "How things run today" trace to R-11 (enquiries), R-22 to R-24 (quotes), R-31 to R-38 (serial numbers), R-39 to R-45 (site work) and R-55 to R-63 (revenue and margins).

**Coverage:** 73 requirements (68 P0, 2 P1, 3 P2). The 31 Oct 15:10 brief audit (Plan.md section 1b) promoted R-59, R-60 and R-63 to P0 and added R-70 to R-73. Every requirement maps to at least one feature, and every feature from F01 to F23 traces back to at least one requirement (F21 is cut).

## 2. Judging criteria (EVENT.md)

| Criterion | Type | How SunPower OS meets it | Where to verify |
|---|---|---|---|
| Use real-time or dynamic data sources; avoid static JSON | Must | Every screen reads MongoDB Atlas through server components and server actions; the seed script writes ~150 projects and 14 months of history to the database; the UI has no JSON fixtures | Run `npm run seed`, then open any list |
| Responsive, clean UI with a consistent colour scheme and layout | Must | One token set (Style_Guide.md), shadcn/ui components, Inter, a 4-pt grid; mobile-first technician screens; breakpoints at 640, 768, 1024 and 1280 px | Style_Guide.md; resize any screen to 360 px |
| Validate user input robustly | Must | Shared Zod schemas in the browser and on the server; Indian formats (mobile, pincode, GSTIN); business-rule gates with typed errors; rate limits on public forms | PRD section 8; `src/lib/schemas` |
| Intuitive navigation, menu placement and spacing | Must | Role-aware sidebar grouped by workflow; ⌘K search; breadcrumbs; each role lands on its own home screen | F02; Features.md route access |
| Use Git properly, with more than one member contributing | Must | Feature branches, pull requests reviewed by the other developer, commits from both members, CI on every pull request | GitHub history; Plan.md section 7 |
| Backend APIs, data model and a local database | Nice | Route handlers under `/api/v1`, a services layer with state machines, Mongoose models with indexes; runs against a local MongoDB by changing `MONGODB_URI` | `engineering/API.md`, `engineering/DB.md` |
| Understand AI and code snippets before using them | Nice | Every module reviewed by the other developer; explainer comments; unit tests for quote maths, state machines, warranty dates and costing | `tests/`; pull request reviews |
| Plan for offline or local solutions | Nice | Barcode decoding on the device with no cloud API; manual serial entry fallback; photo compression in the browser; offline drafts for technician forms (F23); local MongoDB for development | F11, F23 |
| Use trendy technologies only when they add value | Nice | Each choice has a reason: server actions remove a separate API layer for internal screens, Zod gives one validation contract, PostHog measures adoption; no AI features for show | `engineering/Engineering.md` |

## 3. Details requested from the team

Status as of 31 Oct 2026 is in the last column. For the hackathon, items 6 to 16 can use realistic placeholders, clearly marked in the seed, until real values arrive.

| # | Detail needed | Used for | Needed by | Owner | Status |
|---|---|---|---|---|---|
| 1 | MongoDB Atlas connection string (`MONGODB_URI`) and network access for Vercel | Database in every environment | Phase 0 | Hanvith | ✅ Provided; Vercel connected (31 Oct) |
| 2 | Vercel project access and permission to set environment variables | Deployments | Phase 0 | Hanvith | ✅ Live |
| 3 | Namecheap domain name and DNS access | Custom domain pointed at Vercel | Phase 5 | Hanvith | ✅ www.sunpowersolutions.me |
| 4 | PostHog project API key and region (US or EU) | Analytics, session replay, exceptions | Phase 4 | Hanvith | ⬜ Pending |
| 5 | Session signing secret (32+ random bytes) | Signing session cookies | Phase 0 | Vamshi generates | ✅ Set locally and in Vercel |
| 6 | Company legal name, registered address, GSTIN (Telangana, starts with 36), PAN, phone and email | Quotes, invoices, certificates | Phase 1 | Company | ⬜ Placeholders in `COMPANY` |
| 7 | Bank account and UPI ID for payment instructions | Quotes and invoices | Phase 3 | Company | ⬜ Pending |
| 8 | Logo approval (amber tile, white sun, "SunPower OS" wordmark) and the company name to print on documents | Brand | Phase 0 | Company | 🟨 Logo in use, approval pending |
| 9 | Real catalog: SKUs, cost and sell prices, HSN codes, warranty months, or approval to use the seeded values | Catalog, quotes, costing | Phase 1 | Company | 🟨 Seeded catalog in use, approval pending |
| 10 | CA confirmation of GST treatment: line-wise rates or the 70:30 rule, installation SAC, battery rate | Quote and invoice tax | Phase 1 | Company | 🟨 Line-wise 5%/18% implemented, CA confirmation pending |
| 11 | Hourly labour rates by technician grade, overtime rule, out-of-warranty labour rate and visit charge | Costing, payouts, service invoices | Phase 3 | Company | 🟨 Seeded ₹250–450/h, service ₹600/h, confirmation pending |
| 12 | Commercial terms: quote validity, minimum advance, payment terms, terms and conditions text | Quotes and orders | Phase 1 | Company | 🟨 15-day validity, 50% advance suggested, confirmation pending |
| 13 | Warranty policy: confirm 24 / 24 / 240 months, workmanship warranty, replacement-unit rule, exclusions | Warranty engine | Phase 2 | Company | 🟨 24/24/240 months implemented, confirmation pending |
| 14 | PM Surya Ghar vendor registration with TSSPDCL and TSNPDCL, and DCR panel confirmation | Subsidy tracker | Phase 3 | Company | ⬜ Pending |
| 15 | First-response target and working hours | SLA badge | Phase 1 | Company | 🟨 2 h SLA (amber at 1 h) implemented, working hours pending |
| 16 | Company WhatsApp and support phone numbers | `wa.me` and `tel:` links on public pages | Phase 1 | Company | ⬜ Placeholder phone |
| 17 | Resend API key and a verified sender domain (P2) | Email notifications | Optional | Vamshi | ⬜ Optional |
| 18 | Demo logins to share with the judges | Evaluation | Phase 5 | Vamshi | ✅ Seeded; shown on the login page |
| 19 | Confirmation that `gppa-odoo` and `hackathon-odoo` were added as collaborators (due 31 Oct, 11:00 AM) | Event rule | Immediately | Hanvith | ✅ Done |
| 20 | Printed barcode labels for about 10 seeded serials, and an Android phone with Chrome | Live scanning demo | Phase 5 | Both | ⬜ Pending |
