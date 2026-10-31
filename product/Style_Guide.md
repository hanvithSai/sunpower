# SunPower: Style Guide

| | |
|---|---|
| **Version** | 2.0, 1 Nov 2026 ("Energy in motion" redesign and the SunPower rebrand) |
| **Owner** | Hanvith Sai Alla (design system, `globals.css`) |
| **Stack** | Tailwind CSS v4, shadcn/ui on Radix, IBM Plex Sans and Bricolage Grotesque (self-hosted), lucide-react, Recharts |
| **Related** | [PRD.md](PRD.md) · [Features.md](Features.md) · [Analytics.md](Analytics.md) |

SunPower should look like the operating system of a renewable-energy company, not a generic admin template. The idea is **energy in motion**: sunlight comes in, gets converted, and flows through the business the way electricity flows through a rooftop system. A deep-forest brand carries the identity on the sidebar, the public header and the hero; a field green marks every action; sunlight amber is the highlight; and a "current" lime is reserved for electricity moving through diagrams. The UI is built with exactly these tokens. Light theme only.

Version 1.0 (31 Oct) was an Apple-style blue system called "SunPower OS". Reviewers found it generic, so 2.0 replaces the palette, type, logo and shell; the component rules and accessibility floor carry over.

## 1. Principles

| Principle | In practice |
|---|---|
| One connected journey | Navigation, the dashboard pipeline and the landing page all follow the project's life: enquiry, survey, quote, order, dispatch, installation, commissioning, service |
| Spend boldness in one place | The landing page's memorable element is the interactive energy-flow diagram; everything else is quiet |
| Real data only | No invented statistics or fake buttons. Illustrations say they are illustrations; estimates say they are estimates |
| Structure that carries meaning | Hairline rules and numbered steps where there is a real sequence, rather than a wall of identical rounded cards |
| Fit for the field | Technician and warehouse screens are mobile-first, with large targets and few fields |

## 2. Logo

- **Mark:** a sunlight-amber sun (#F2B441) rising behind a sage solar panel (#DCE9DF, three cells divided by forest lines) on a deep-forest rounded tile (#0F2F24) with a faint sage outline so it also reads on forest surfaces. Original artwork in `src/components/brand/logo.tsx`, `src/app/icon.svg` and `public/logo.svg`.
- **Wordmark:** "SunPower" in Bricolage Grotesque semibold, −0.02 em tracking, forest ink on light surfaces and white on forest.
- **Name:** always "SunPower" (the product and the company's short name); "SunPower Solutions Pvt. Ltd." on legal and customer documents. Never "SunPower OS", "Sunpower" or "Sun Power".
- **Sizes:** sidebar and header tile 28–32 px with a 17–19 px wordmark; sign-in tile 44 px with a 25 px wordmark; the favicon is the mark alone. Minimum 20 px.
- **Don't:** recolour the sun, add gradients or shadows, place the mark on photos or use it as a button.

## 3. Colour

### 3.1 Core palette

| Token | Hex | Use |
|---|---|---|
| Forest | #0F2F24 | Brand surfaces: sidebar, public header and footer, hero, dark bands, the pipeline strip |
| Forest raised | #163D30 | Panels on forest (the energy-flow card) |
| Field green (primary) | #1D5C40 | Primary buttons, links, selected states, focus ring |
| Primary hover | #174A33 | Hover on primary buttons |
| Sunlight amber | #F2B441 | Highlights: calls to action on forest, the active-page marker, the sun, chart "cash" accents (darkened, see 9) |
| Amber text | #8A5300 | Amber as text on light surfaces |
| Current lime | #B9EF62 | Electricity moving in diagrams and live pipeline stages, **on forest only** (Tailwind `volt`) |
| Ink | #18261F | Headings and body text |
| Secondary text | #536158 | Labels, helper text, metadata, placeholders |
| Forest text / muted | #E8F0E9 / #9FB3A6 | Body text and secondary text on forest |
| Canvas | #F3F5F0 | App and page background (sage white) |
| Sage | #DCE9DF | Tinted bands (the subsidy section), panel cells in the mark |
| Surface | #FFFFFF | Cards, tables, dialogs, inputs |
| Line | #DBE2DA | Dividers, card and table rules |
| Input border | #7C897F | Text fields, selects, checkboxes, outline buttons |

### 3.2 Status colours

Badges use a 12% tint of the base colour with the dark text variant.

| Status | Base | Text variant |
|---|---|---|
| Success | #2E9B63 | #1A6E45 |
| Warning | #E8A317 | #8F4A00 |
| Danger | #E5484D | #B42318 |
| Info | #2F7ED8 | #1B5A9E |
| Neutral | #536158 | #536158 on the canvas |

Avatars use seven earth tones (forest, sunlight, sky, clay, moss, teal, plum) with dark text variants, all at least 5.9:1; on the forest sidebar the avatar is amber with forest initials.

### 3.3 Rules

- **Field green means "you can act."** Status success uses its own greens and always carries an icon or label, so the two never get confused.
- **Lime is electricity, nothing else.** Never use it for text on light surfaces or for decoration.
- **Amber is light and attention.** The primary action *on forest* is amber with forest text; on light surfaces the primary action is field green.
- **Colour is never the only signal:** every status has a text label, and an icon where space allows.
- No gradients except two faint radial "sunlight" washes (hero and sign-in), no glassmorphism, no neon.

## 4. Typography

- **Interface: IBM Plex Sans** (variable, 100–700). Technical, highly legible, with good tabular figures for money and measurements.
- **Display: Bricolage Grotesque** (variable, 200–800). Used for `h1` and `h2` (page and section titles), the wordmark, KPI and pipeline numbers, and the landing page headlines. Tracking −0.015 em to −0.03 em at large sizes.
- Both are self-hosted with `next/font/local` from `src/app/fonts` (SIL Open Font License), so nothing is fetched from Google at build or run time.
- **Numbers:** `tabular-nums` for amounts, quantities, counts and table dates (tables get it by default).

| Style | Size / line height (px) | Face, weight | Use |
|---|---|---|---|
| Hero | 42–68 / 1.02 | Bricolage, semibold | Landing hero |
| Display | 36–48 / 1.1 | Bricolage, semibold | Landing section titles |
| Title 1 | 28 / 34 | Bricolage, semibold | Page titles |
| Title 2 | 20–22 / 28 | Bricolage, semibold | Section headings on detail pages |
| Headline | 15–17 / 22 | Plex, semibold | Card and table titles |
| Body | 15 / 22 | Plex, regular | Paragraphs, form values on mobile |
| Callout | 14 / 20 | Plex, regular | **Default UI and table text**, inputs; buttons in medium |
| Footnote | 13 / 18 | Plex, regular | Field labels, helper and error text; sidebar section names |
| Caption | 11–12 / 16 | Plex, medium | Badges, timestamps, chart axes |

Sentence case everywhere. No tracked-out capital "eyebrow" labels, no monospace for small labels.

## 5. Layout and spacing

- **4-pt grid:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px.
- **Page padding:** 24 px on desktop, 16 px on mobile. The app's main column is up to 1280 px wide; landing sections up to 1152 px.
- **Landing rhythm:** 80–112 px between sections, alternating canvas, white, sage and forest bands so each section reads as its own chapter.
- **App structure:** forest sidebar 256 px (68 px collapsed) from `lg`; sticky top bar 56 px; forms single column up to 640 px; detail pages with a main column and a side panel from `lg`.

## 6. Shape and elevation

| Token | Value | Use |
|---|---|---|
| Radius, controls | 8 px | Buttons, inputs, selects, segmented controls, menus |
| Radius, cards | 12–14 px | Cards, dialogs, the energy-flow panel, the pipeline strip |
| Radius, sheets | 18 px | Sheets and large panels |
| Radius, badges | Full pill | Badges, chips, filter pills |
| Shadow, card | `0 1px 0 rgb(15 47 36 / .05)` | Cards separate by a hairline border, not a shadow |
| Shadow, elevated | `0 16px 40px -10px rgb(15 47 36 / .22)` | Menus, dialogs, ⌘K, toasts, the cookie banner |

Groups of equal items (the landing platform grid, the facts strip) use 1 px rules between cells rather than separate floating cards.

## 7. Icons

- lucide-react only, stroke width **1.75**. Sizes: 16 px inline, 18 px navigation, 20–24 px headers and diagram parts.
- Icons inherit the text colour. Icon-only buttons need an `aria-label` and a tooltip.
- Domain icons: `SolarPanel`, `SunMedium`, `Cpu` (inverter), `Gauge` (charge controller), `BatteryCharging`, `House`, `UtilityPole`; navigation icons are defined in `src/lib/navigation.ts`.

## 8. Motion

- One orchestrated element per screen. Interface motion is 150–200 ms ease-out on opacity and transform; no bounce or overshoot.
- **Energy flow:** current moves along the diagram's wires as a dashed stroke (`energy-dash`, 0.9 s linear loop) with arrowheads showing direction, so the meaning survives when motion is off.
- **Journey line:** on the landing page the line under the eight steps fills as it scrolls into view (CSS scroll-driven animation, progressive enhancement; static where unsupported).
- Sidebar collapse animates width (200 ms). Menus and popovers fade with a 4 px slide; dialogs fade and scale from 0.96.
- `prefers-reduced-motion: reduce` freezes the energy dashes and the journey fill, and turns movement into instant changes.

## 9. Components

### Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | #1D5C40 fill, white text; hover #174A33 | One per view: Create quote, Record payment, Dispatch |
| Primary on forest | #F2B441 fill, #0F2F24 text | Calls to action on forest bands (Get a free quote) |
| Outline | White fill, 1 px #7C897F border, ink text | Every other action |
| Ghost / link | No fill, field-green text | Low emphasis: Cancel, View all |
| Destructive | Danger text; filled danger only inside a confirmation dialog | Cancel order, Revoke link |

- Height 36 px on desktop and **44 px on touch screens**; label in Callout, medium; 16 px icon with an 8 px gap.
- States: hover, pressed, focus ring, disabled (40% opacity) and loading (spinner replaces the icon, button disabled).
- **Gate buttons** (blocked by a business rule) stay visible but disabled, with the reason next to them: "Approve the survey to create a quote", "Scan 1 more serial to dispatch".

### Inputs

- Height 36 px (44 px on touch), radius 8 px, 1 px #7C897F border, white fill, Callout text, #536158 placeholder.
- Label above every field (Footnote, medium); helper text below; errors below in danger text with a danger border and an alert icon.
- Focus: field-green border and the focus ring. Special fields: ₹ amounts with lakh grouping, +91 mobile with a numeric keypad, 6-digit PIN, serials in capitals with autocorrect off, dates as DD MMM YYYY.

### Tables

- Callout text, headers in Footnote semibold secondary text, sentence case; 44 px rows with #DBE2DA separators; numbers right-aligned in tabular figures; first column links to the record; 25 rows per page; stacked cards below `md`.
- Profit table: loss-making rows get the danger tint; rows below 15% margin get the warning tint.

### Badges

Pill, Caption medium, tinted background with the dark text variant, optionally a 6 px dot in the current text colour.

| Meaning | Colour | Examples |
|---|---|---|
| Done, healthy | Success | Approved, Won, Paid, Commissioned, In warranty, Customer confirmed, Disbursed |
| Moving, waiting on us | Info | New, Contacted, Scheduled, Sent, Confirmed, Dispatched, Delivered, In progress |
| Needs attention | Warning | Uncontacted 1 h, Submitted (needs review), Pending payment, Awaiting confirmation, Low stock |
| Blocked, late, failed | Danger | Uncontacted 2 h, Survey rejected, Overdue, Out of warranty, Loss |
| Inactive, finished | Neutral | Draft, Superseded, Declined, Lost, Cancelled, Closed |

### Cards

White surface, 12–14 px radius, hairline border, 20–24 px padding. KPI cards: label in Footnote secondary, value in Bricolage with tabular figures, change against the previous period with an arrow.

### Navigation (app shell)

- **Sidebar:** forest, sections in sentence case that follow the project's life: Overview, Customer acquisition, Sales, Operations, After-sales, Business. Each item has a one-line purpose as its tooltip. The current page gets a white-tinted row, an amber icon and a 3 px amber marker. Collapses to 68 px icons (labels move into tooltips); the choice is remembered on the device.
- **Top bar:** "Section / Page" location (from `xl`), ⌘K search, a primary **New** menu with the role's quick actions (the same list as ⌘K), and the account menu.
- **Mobile:** the same navigation in a forest sheet from the hamburger.

### Lifecycle pipeline (dashboard)

A forest strip: "Every project, stage by stage", seven numbered stages (Enquiry → Survey → Quote → Order → Dispatch → Installation → Commissioned) separated by hairlines. Each shows a live count in Bricolage, what the count means, and a lime dot when work is waiting (amber for Commissioned). Every stage links to its module. Counts come from current statuses only.

### Energy-flow diagram (landing)

A forest-raised panel: system type (On-Grid, Off-Grid, Hybrid) as a segmented control with the active option in amber; the parts as 44–56 px circular buttons with labels and status tags ("Exporting", "Charging", "Switched off"); faint wires for every connection and lit, animated wires with arrows for the current moment (Sunny afternoon, Evening, Power cut); a one-sentence story below that changes with the moment, or the clicked part's explanation. Always labelled "An illustration, not live data". Hybrid carries a note that SunPower doesn't install hybrid systems yet.

### Empty, loading and error states

- **Empty:** icon in a 40 px canvas circle, a Headline title, one sentence that invites action, one primary action.
- **Loading:** skeletons matching the final layout (on forest, white at 10% opacity); no full-page spinners.
- **Error:** what went wrong and how to fix it, with Retry; the sidebar keeps working.

### Toasts

Bottom-right on desktop, top-centre on mobile; elevated shadow. Success in the past tense ("Payment of ₹50,000 recorded", 4 s); errors say how to fix it and stay until dismissed. Announced with `aria-live`.

### Cookie banner

Fixed to the bottom with 12 px insets, up to 672 px wide, elevated card; a non-modal landmark. **Reject analytics** and **Accept analytics** are the same variant (outline) and size. Reopened from "Cookie settings" it shows the current state and a close button.

### Command palette (⌘K)

Elevated card about 640 px wide; results grouped under Footnote headers (Customers, Serials, Leads, Quotes, Orders, Tickets, Invoices); quick actions shared with the top bar's New menu.

### Charts

Recharts. Invoiced series #1D5C40 (7.9:1 on white), cash series #B8801A (3.4:1, above the 3:1 needed for graphics), gridlines #DBE2DA, axis labels in Caption #536158, ₹ axis values in compact form (₹5 L). Every chart has a title, units, a legend and a "Show as a table" alternative.

## 10. Content style

- **Sentence case everywhere**; buttons start with a verb and name the object ("Record payment", "Book a free roof survey").
- **Money:** ₹ with lakh grouping (₹1,50,000); compact on KPIs and axes (₹18.6 L, ₹1.2 Cr). **Dates:** DD MMM YYYY, IST. **Units:** "3 kW", "545 Wp", "15%".
- **Voice:** plain, polite Indian English; "you"; no jargon on public pages ("solar panels", not "PV modules"); never blame the user.
- **Honesty:** estimates are labelled as estimates ("An estimate under current rules, not an approval"), illustrations as illustrations; no statistic appears unless the system can back it.

## 11. Accessibility

Target: **WCAG 2.2 AA**.

- **Contrast:** text at least 4.5:1, large text at least 3:1, meaningful icons, chart marks and component boundaries at least 3:1.
- **Focus:** a **solid 2 px #1D5C40 ring with a 2 px offset** on `:focus-visible` everywhere.
- **Touch targets:** at least 44 × 44 px on touch screens, with 8 px between targets.
- **Forms:** visible labels; errors linked with `aria-describedby`; first invalid field takes focus.
- **Keyboard:** logical order; ⌘K / Ctrl+K opens search; Esc closes dialogs; the energy-flow parts and switches are real buttons with `aria-pressed`.
- **Screen readers:** landmarks and a unique title on every page; `lang="en-IN"`; `aria-live` for toasts, scan results, the energy-flow story and the subsidy estimate.
- **Motion:** honour `prefers-reduced-motion` (section 8).

### Contrast check (measured)

Measured 1 Nov 2026 against the tokens in `src/app/globals.css` (WCAG 2.x relative luminance; badge tints are 12–16% of the base colour over white).

| Pair | Ratio | Result |
|---|---|---|
| Ink #18261F on surface / on canvas | 15.7:1 / 14.3:1 | Pass |
| Secondary text #536158 on surface / canvas / darkest tinted fill | 6.5:1 / 5.9:1 / 5.2:1 | Pass |
| White on primary #1D5C40 / on hover #174A33 | 7.9:1 / 10.2:1 | Pass |
| Primary text on surface / on canvas | 7.9:1 / 7.2:1 | Pass |
| Amber text #8A5300 on surface / canvas / its tint | 6.3:1 / 5.8:1 / 5.8:1 | Pass |
| Forest #0F2F24 on amber (CTA on forest) | 7.8:1 | Pass |
| Lime #B9EF62 / amber / forest text #E8F0E9 / muted #9FB3A6 on forest | 10.7:1 / 7.8:1 / 12.4:1 / 6.5:1 | Pass |
| Forest text at 75% opacity on forest / on the raised panel; muted on the raised panel / on the active sidebar row | 7.7:1 / 6.9:1; 5.7:1 / 4.8:1 | Pass |
| Badge text on its tint: success / warning / danger / info | 5.5:1 / 6.0:1 / 5.6:1 / 6.1:1 | Pass |
| Focus ring #1D5C40 against white / canvas | 7.9:1 / 7.2:1 | Pass |
| Input border #7C897F against white | 3.7:1 | Pass |
| Chart marks: invoiced #1D5C40 / cash #B8801A on white | 7.9:1 / 3.4:1 | Pass (graphics ≥ 3:1) |

### Known gaps

1. **Hairline borders** (#DBE2DA, 1.3:1) separate decorative structure only; every interactive boundary uses the input border (3.7:1).
2. **Display font coverage:** Bricolage Grotesque ships the Latin subset only; Telugu or Hindi text in titles would fall back to Plex and then the system font.

## 12. Responsive behaviour

| Breakpoint | Min width | Layout |
|---|---|---|
| Base | 0 | Single column; sidebar in a sheet; tables become stacked cards; energy-flow diagram full width; sticky bottom action bar on technician forms |
| `sm` | 640 px | Two-up cards; wider dialogs; full labels in segmented controls |
| `md` | 768 px | Tables return; two-column forms; landing system columns side by side |
| `lg` | 1024 px | Persistent forest sidebar; hero splits text and diagram; detail pages gain a side panel |
| `xl` | 1280 px | Top-bar location; pipeline shows all seven stages in one row |

- **Technician screens are mobile-first:** `/my-work`, `/surveys/[id]`, `/jobs/[id]`, `/service/[id]` and the `/dispatch/[orderId]` scanner are designed at 360–414 px for one-handed use.
- **Test widths:** 360/375, 768, 1024 and 1440 px, plus a real Android phone in Chrome for camera scanning.
