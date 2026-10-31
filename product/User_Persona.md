# SunPower OS: User Personas

| | |
|---|---|
| **Version** | 1.0, 31 Oct 2026 |
| **Owner** | Hanvith Sai Alla (product) |
| **Related** | [PRD.md](PRD.md) · [Features.md](Features.md) · brief: [Solar_Installation_Management_System.md](../Solar_Installation_Management_System.md) |

Six personas drive SunPower OS: five people inside SunPower Solutions and one homeowner. They are composites built from the six scenes in the brief (S1 to S6 below), and their names match the seeded demo users.

| Persona | Role | Device | Top need | Scenes |
|---|---|---|---|---|
| Rajesh Reddy | Director (`admin`) | Laptop, iPhone | Profit per job and unfinished work | S2, S5, S6 |
| Priya Sharma | Sales (`sales`) | Laptop, Android | Fast follow-up and correct quotes | S1, S2 |
| Ravi Kumar | Technician (`technician`) | Android phone | Clear schedule, complete kit, quick sign-off | S1, S2, S4, S5 |
| Suresh Yadav | Warehouse (`warehouse`) | Desktop, Android | Right kit, every serial recorded | S2, S3 |
| Anjali Rao | Support (`support`) | Laptop with headset | Customer, serial and warranty in seconds | S5 |
| Lakshmi Narayana | Homeowner (public) | Android phone | Lower bill, subsidy, trustworthy service | S1 to S5 |

Scenes: S1 The rooftop inquiry · S2 Getting the kit right · S3 Dispatch day and serial numbers · S4 On the roof · S5 The rainy season breakdown · S6 The director's month-end.

## 1. Rajesh Reddy, director and founder

| | |
|---|---|
| **Profile** | 48, founder; B.Tech (electrical), 12 years at a power-sector contractor before starting SunPower; office in Begumpet, Hyderabad |
| **Devices** | Laptop in the office, iPhone everywhere else; lives in WhatsApp groups |
| **In his words** | "I know we are busy. I don't know if we are making money." |

**Goals**
- Grow from about 40 to 60 installations a month without hiring more technicians.
- Know the profit on every job and stop repeating loss-making ones.
- Collect advances and balances faster, and get every customer's subsidy released, because happy customers refer neighbours.

**Frustrations today**
- S6: month-end takes two days of collecting notebooks, bank messages and WhatsApp screenshots, and he still can't say which jobs lost money.
- S2: hand-typed quotes miss parts, so crews make second trips and give free extras that quietly eat the margin.
- S5: support gives free repairs on units that were out of warranty, because nobody can prove the dates.
- S6: subsidy files wait at the DISCOM and nobody has a list of who is stuck where; technician pay is worked out from memory.

**A day in the life**
- 08:30 scrolls five WhatsApp groups (sales, crew, warehouse, service, accounts) looking for problems.
- 11:00 meets a small-factory owner in Jeedimetla about a 5 kW system.
- 15:00 calls the accountant to match advances against bank statements.
- 19:00 tries to answer "how did we do this month?" from an Excel sheet that is two weeks old.

**How SunPower OS helps**
- `/dashboard` shows today, this week and this month: revenue, cash collected, margin, commissioned installations and open repairs.
- The profit-per-job table puts losers in red, for example a job that lost ₹6,400 on rework and extra cable.
- Stuck projects list the stage, the owner and the days waiting; the subsidy board shows every application by stage.
- A share link and a CSV export replace the month-end scramble.

**Key screens:** `/dashboard`, `/orders/[id]` (costing), `/subsidy`, `/team`, `/catalog`, `/share/[token]`.

## 2. Priya Sharma, sales executive

| | |
|---|---|
| **Profile** | 27, MBA (marketing), 3 years in solar sales; works from the Begumpet office; speaks Telugu, Hindi and English |
| **Devices** | Laptop at her desk, Android phone for calls and WhatsApp |
| **In her words** | "If I don't call within an hour, another installer will." |

**Goals**
- Call every enquiry the same day, ideally within the hour.
- Send a correct quote within a day of the survey.
- Convert more qualified leads, and always know who has paid what.

**Frustrations today**
- S1: enquiries arrive through the website inbox, her own WhatsApp, the office landline and walk-ins, and some slip through.
- S1: she sometimes quotes before the survey, then has to revise when the roof turns out to be shaded.
- S2: she builds quotes in Excel from memory and has missed MC4 connectors and earthing kits, so the crew calls her from the roof.
- S2: after every payment she phones the warehouse and the crew lead to start work.

**A day in the life**
- 09:30 checks the overnight web enquiries.
- 10:00 to 13:00 calls back new leads and qualifies them on the phone: roof area, bill, grid connection.
- 14:30 reviews surveys that technicians submitted from site.
- 16:00 builds and sends three quotes on WhatsApp.
- 18:00 records the day's UPI advances.

**How SunPower OS helps**
- One pipeline for every channel, with a red badge on any lead waiting more than 2 hours.
- One-tap Call and WhatsApp buttons that log the contact.
- A qualification checklist and survey approval that unlocks the quote, so she never quotes a shaded roof again.
- Choosing "3 kW On-Grid" fills the whole BOM with GST and subsidy; recording the advance creates the pick list and the installation job.

**Key screens:** `/leads`, `/leads/[id]`, `/surveys/[id]`, `/quotes/new`, `/quotes/[id]`, `/orders/[id]`.

## 3. Ravi Kumar, senior technician

| | |
|---|---|
| **Profile** | 32, ITI electrician, 8 years installing rooftop systems, leads a 3-person crew; lives in LB Nagar; prefers Telugu, reads English |
| **Devices** | Mid-range Android phone on 4G, often low on battery by afternoon; patchy signal on rooftops |
| **In his words** | "Just tell me where to go and make sure the truck has everything." |

**Goals**
- Know the day's jobs and addresses before leaving home.
- Find the complete kit on the truck, every time.
- Finish the job and get the customer's sign-off quickly, and get paid for overtime.

**Frustrations today**
- S2: the schedule arrives as phone calls at 7 AM and changes during the day.
- S2 and S3: a missing lightning arrestor or MC4 connector means a second trip across the city.
- S1: survey notes on paper get lost, and Sales calls him to measure again.
- S4: the site register and photos stay on his personal phone; his overtime is never recorded.
- S5: he arrives at service visits without knowing what was installed or when.

**A day in the life**
- 07:30 opens My work: one survey and one installation today.
- 09:00 survey in Gachibowli: direction, tilt, cable runs and photos, submitted from the roof.
- 11:00 installation in KPHB Colony, Kukatpally: structure, 6 panels, ACDB/DCDB, earthing, generation test.
- 15:30 the homeowner signs on his phone and the certificate is generated.
- 17:00 service visit in Miyapur: an inverter fault, a replacement unit and parts logged on the ticket.

**How SunPower OS helps**
- `/my-work` lists today's surveys, jobs and tickets with address, map link and a Call button.
- Short forms with 44 px targets and photos compressed for weak networks; offline drafts (P2).
- A signature pad and an automatic certificate replace the site register.
- Start and finish times become his hours, so overtime is counted.

**Key screens:** `/my-work`, `/surveys/[id]`, `/jobs/[id]`, `/service/[id]`.

## 4. Suresh Yadav, warehouse in-charge

| | |
|---|---|
| **Profile** | 41, 15 years in stores and logistics; runs the warehouse in Jeedimetla industrial area; used to stock registers |
| **Devices** | Desktop at the warehouse desk, Android phone for scanning at the loading bay |
| **In his words** | "If it isn't written down, it didn't leave my warehouse." |

**Goals**
- Pack the exact kit for every order.
- Never lose track of a serial number.
- Reorder before stock runs out, and receive supplier deliveries quickly.

**Frustrations today**
- S2: he learns what to pack from a phone call or a photo of a quote on WhatsApp.
- S3: serial numbers are written in a register and are unreadable by the time support needs them.
- S3: once an inverter went to the wrong customer and nobody could tell which unit went where.
- Stock is counted only on Saturdays, and an inverter is worth more than ₹40,000.

**A day in the life**
- 08:00 a supplier truck arrives with 60 panels and 5 inverters; he records the GRN and serials.
- 10:00 picks three orders from their pick lists.
- 11:30 scans serials at the loading bay; one wrong inverter is caught before it leaves.
- 12:00 dispatches, and marks the order delivered when the driver calls from site.
- 16:00 checks the low-stock list and asks the director to reorder.

**How SunPower OS helps**
- Pick lists appear the moment an order is confirmed.
- Camera scanning with instant checks; Dispatch stays locked until every serial is scanned.
- A serial register with full history from GRN to customer.
- GRN with bulk serial paste, and low-stock badges.

**Key screens:** `/dispatch`, `/dispatch/[orderId]`, `/inventory`, `/inventory/purchases`, `/inventory/serials`.

## 5. Anjali Rao, customer support

| | |
|---|---|
| **Profile** | 25, B.Com, 2 years in a telecom call centre; fast typist; fluent in Telugu, Hindi and English |
| **Devices** | Laptop with a headset at the Begumpet office |
| **In her words** | "The customer is on the line. I need the answer now, not tomorrow." |

**Goals**
- Answer "is it under warranty?" during the first call.
- Send the right technician the same day.
- Keep customers informed, and close tickets only when they are happy.

**Frustrations today**
- S5: rainy days bring 20 to 30 "zero power" calls, and finding a customer means searching WhatsApp chats and paper registers.
- S5: without warranty dates she either charges a customer who is covered or gives a free repair that should be billed.
- S5: complaints written in a notebook get forgotten, and nobody records whether the customer confirmed the fix.

**A day in the life**
- 09:00 monsoon morning; the phone keeps ringing.
- 09:05 Lakshmi Narayana calls about an inverter fault code; she types the last 4 digits of the serial into ⌘K and sees "In warranty · 6 months left".
- 09:07 creates a ₹0 ticket and assigns Ravi.
- 12:00 an out-of-warranty case: when the technician resolves it, the invoice is created automatically.
- 17:00 calls customers with Resolved tickets and records their confirmation.

**How SunPower OS helps**
- ⌘K search by mobile, name or serial in under a second.
- A warranty card with the exact state and dates, so ₹0 or billed is never a guess.
- A ticket lifecycle that can't close until the customer confirms.
- WhatsApp updates through `wa.me` links.

**Key screens:** ⌘K search, `/service`, `/service/new`, `/service/[id]`, `/invoices/[id]`.

## 6. Lakshmi Narayana, homeowner

| | |
|---|---|
| **Profile** | 61, retired BHEL engineer; lives with his wife in an independent G+1 house in KPHB Colony, Kukatpally, Hyderabad; flat RCC roof of about 600 sq ft, mostly shadow-free |
| **Home energy** | TSSPDCL consumer; bill of ₹3,000 to ₹3,500 a month in summer (two air conditioners) |
| **Devices** | Android phone; uses WhatsApp and UPI every day; reads every line of a quote |
| **In his words** | "Show me exactly what I am paying for, and tell me when the subsidy comes." |

**Goals**
- Bring his electricity bill close to zero with a 3 kW On-Grid system.
- Get the PM Surya Ghar subsidy (₹78,000 for 3 kW) without running around offices.
- Know exactly what was installed, and get quick help if something breaks.

**Frustrations today**
- S1: two other installers never called back after he filled in their web forms.
- S2: another quote was a single lump sum with no parts list.
- S4: his neighbour's installer left no record of what was installed.
- S5: the same neighbour waited a week to learn whether his inverter was under warranty.

**His journey with SunPower**
- Day 1, 11:00 AM: fills in `/enquiry` on his phone (3 kW, subsidy yes) and gets reference SP-L-0231. At 11:40 AM Priya calls and qualifies the roof.
- Day 4: Ravi surveys the roof.
- Day 5: an itemised quote on WhatsApp: ₹1,75,200 including GST, expected subsidy ₹78,000, effective cost ₹97,200 (illustrative). He pays a ₹50,000 advance by UPI.
- Day 9: the kit is delivered and installed; he signs on the technician's phone and receives the installation certificate.
- Months 2 to 3: TSSPDCL installs the net meter and the subsidy reaches his bank account; SunPower tracks every step.
- Month 18: during the rains the inverter shows a fault. Anjali finds his serial in seconds: in warranty, ₹0. The ticket closes after he confirms the power is back.

**How SunPower OS helps**
- A two-minute enquiry form and a call within hours.
- A clear, itemised quote with GST and the subsidy shown separately.
- A signature and a certificate as proof of what was installed.
- `/warranty` to check any unit himself, and a project tracking link (P2).

**Key screens:** `/`, `/enquiry`, `/warranty`, `/share/[token]`, printed quote and installation certificate.
