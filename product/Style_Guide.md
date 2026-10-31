# SunPower OS: Style Guide

| | |
|---|---|
| **Version** | 1.1, 31 Oct 2026 (WCAG AA colour pass) |
| **Owner** | Hanvith Sai Alla (design system, `globals.css`) |
| **Stack** | Tailwind CSS v4, shadcn/ui, Inter via `next/font`, lucide-react, Recharts |
| **Related** | [PRD.md](PRD.md) · [Features.md](Features.md) |

An Apple-inspired system: a quiet grey canvas, white cards, one blue for actions, clear type and generous space, so the data and the next step stand out. The values in this guide are final and the UI is built with exactly these tokens. Light theme only in v1.0.

## 1. Principles

| Principle | In practice |
|---|---|
| Clarity | One primary action per view; plain words; numbers right-aligned in tabular figures |
| Deference | Grey canvas and white surfaces; colour only for actions and status |
| Consistency | The same tokens, components and patterns on every screen and for every role |
| Fit for the field | Technician screens are mobile-first, with large targets and few fields |

## 2. Logo

- **Construction:** a rounded-square tile filled with an amber linear gradient from #FFB340 (top-left) to #FF9F0A (bottom-right), with a white sun glyph (lucide `Sun`) centred in it. The wordmark follows: "SunPower" in semibold ink (#1D1D1F) and "OS" in ink at 70% opacity, with a single space between them.
- **Recommended sizes:** sidebar tile 28 px with a 17 px wordmark; sign-in page tile 40 px with a 22 px wordmark; the favicon uses the tile alone.
- **Clear space:** at least half the tile's width on every side. **Minimum size:** 20 px tile.
- **Don't:** recolour or re-angle the gradient, stretch the tile, add outlines or shadows, place it on photos, use it as a button, or write the name as "Sunpower" or "SunPowerOS".
- **Customer documents** (quote, invoice, certificate) show the tile with the company name "SunPower Solutions"; "SunPower OS" is the product name inside the app.

## 3. Colour

### 3.1 Core palette

| Token | Hex | Use |
|---|---|---|
| Primary | #0066CC | Primary buttons, links, selected states, focus (was #0071E3 before the AA pass) |
| Primary hover | #0066CC | Same as primary since the AA pass; the pressed state dims to 90% |
| On primary | #FFFFFF | Text and icons on primary |
| Accent (sun amber) | #FF9F0A | Logo and brand highlights on public pages |
| Ink | #1D1D1F | Headings and body text |
| Secondary text | #66666B | Labels, helper text, metadata, placeholders (was #6E6E73) |
| Background | #F5F5F7 | App canvas |
| Surface | #FFFFFF | Cards, tables, dialogs, inputs |
| Separator / border | #E5E5EA | Dividers, card and table rules |
| Input border | #86868B | Text fields, selects, checkboxes, secondary buttons |

### 3.2 Status colours

Badges use a soft tint of the base colour (about 12%) with the dark text variant. The tint values below are the 12% mix over white.

| Status | Base | Text variant | Badge background |
|---|---|---|---|
| Success | #34C759 | #17732F | rgba(52, 199, 89, 0.12) ≈ #E7F8EB |
| Warning | #FF9F0A | #A64A00 | rgba(255, 159, 10, 0.12) ≈ #FFF3E2 |
| Danger | #FF3B30 | #D70015 | rgba(255, 59, 48, 0.12) ≈ #FFE7E6 |
| Info | #007AFF | #0040DD | rgba(0, 122, 255, 0.12) ≈ #E0EFFF |
| Neutral | #66666B | #66666B | #F5F5F7 (background token) |

### 3.3 Rules

- **Blue means "you can act."** Never use #0066CC for decoration or status. Info status uses its own blues (#007AFF, #0040DD).
- **Amber is the brand in the logo; inside the app amber means warning.** Don't use the accent as decoration near status information.
- **Base status colours** are for dots, icons, chart marks and fills. **Text uses the dark variant**, because the base colours are too light for text on white.
- **Colour is never the only signal:** every status has a text label, and an icon where space allows.

## 4. Typography

- **Font:** Inter, loaded with `next/font` (self-hosted at build time, no runtime request to Google). Fallback stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Weights:** 400 regular, 500 medium (buttons, tabs, badges), 600 semibold (headings, emphasis). No 700.
- **Numbers:** `font-variant-numeric: tabular-nums` for every figure: amounts, quantities, KPI values and table dates.

| Style | Size / line height (px) | Weight | Use |
|---|---|---|---|
| Display | 34 / 41 | Semibold | Landing hero, sign-in heading |
| Title 1 | 28 / 34 | Semibold | Page titles, KPI values |
| Title 2 | 22 / 28 | Semibold | Section headings on detail pages |
| Title 3 | 20 / 25 | Semibold | Dialog titles, card group headings |
| Headline | 17 / 22 | Semibold | Card and table titles |
| Body | 15 / 20 | Regular | Paragraphs, form values on mobile |
| Callout | 14 / 19 | Regular | **Default UI and table text**, inputs; buttons in medium |
| Footnote | 13 / 18 | Regular | Field labels, helper and error text; table headers in semibold |
| Caption | 12 / 16 | Regular | Badges (medium), timestamps, chart axes |

Use at most two type styles inside one component, keep paragraphs under about 75 characters per line, and never set text in all capitals.

## 5. Layout and spacing

- **4-pt grid:** spacing values are 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64 px.
- **Page padding:** 24 px on desktop, 16 px on mobile.
- **Card padding:** 20–24 px (20 on mobile, 24 on desktop).
- **Grid gaps:** 16 px between items inside a section and on mobile; 24 px between cards on desktop.
- **Structure:** sidebar about 240 px wide from `lg`; forms in a single column up to 640 px wide; detail pages with a main column and a side panel (summary, timeline) from `lg`.

## 6. Shape and elevation

| Token | Value | Use |
|---|---|---|
| Radius, controls | 10 px | Buttons, inputs, selects, segmented controls, menus |
| Radius, cards | 16 px | Cards, dialogs, command palette, sheets, toasts |
| Radius, badges | Full pill (9999 px) | Badges, chips, filter pills |
| Shadow, card | `0 1px 2px rgba(0,0,0,.04), 0 1px 1px rgba(0,0,0,.02)` | Cards on the grey canvas |
| Shadow, elevated | `0 8px 30px rgba(0,0,0,.08)` | Popovers, menus, dialogs, ⌘K palette, toasts |

White cards sit on the #F5F5F7 canvas with the card shadow and no border. A card inside a white surface uses a 1 px #E5E5EA border instead of a shadow.

## 7. Icons

- lucide-react only, stroke width **1.75**.
- Sizes: **16 px** inline (buttons, tables, badges), **18 px** navigation, **20 px** page and card headers.
- Icons inherit the text colour. Icon-only buttons need an `aria-label` and a tooltip.

| Area | Icon | Area | Icon |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | Dispatch | `Truck` |
| My work | `ListChecks` | Jobs | `HardHat` |
| Leads | `Users` | Service | `LifeBuoy` |
| Surveys | `ClipboardList` | Invoices | `Receipt` |
| Catalog | `Package` | Subsidy | `Landmark` |
| Quotes | `FileText` | Team | `UsersRound` |
| Orders | `ShoppingCart` | Search | `Search` |
| Inventory | `Boxes` | Scan / warranty | `ScanBarcode` / `ShieldCheck` |

## 8. Motion

- 150–200 ms with ease-out. No bounce or spring overshoot. Animate opacity and transform only.
- Hover and press: 150 ms. Menus and popovers: 150 ms fade with a 4 px slide. Dialogs and ⌘K: 200 ms fade with a 0.98 → 1 scale. Toasts: 200 ms slide in.
- `prefers-reduced-motion: reduce` turns movement into instant changes or a plain fade, stops skeleton shimmer and disables smooth scrolling.

## 9. Components

### Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | #0066CC fill, white text; pressed 90% | One per view: Create quote, Record payment, Dispatch |
| Secondary | White fill, 1 px #86868B border, ink text | Every other action |
| Tertiary | No fill, #0066CC text | Low emphasis: Cancel, View all |
| Destructive | White fill, #D70015 text; filled #D70015 with white text only inside a confirmation dialog | Cancel order, Revoke link |

- Height 36 px on desktop and **44 px on technician and other touch screens**; 16 px side padding; label in Callout, medium; 16 px icon with an 8 px gap.
- States: hover, pressed, focus ring, disabled (40% opacity, no pointer events) and loading (spinner replaces the icon, button disabled).
- **Gate buttons** (blocked by a business rule) stay visible but disabled, with a lock icon and the reason next to them: "Approve the survey to create a quote", "Scan 1 more serial to dispatch".

### Inputs

- Height 36 px (44 px on touch screens), radius 10 px, 1 px #86868B border, white fill, Callout text, #66666B placeholder.
- Label above every field (Footnote, medium); helper text below (Footnote, secondary); errors below in Footnote #D70015 with a #FF3B30 border and an alert icon.
- Focus: the border turns #0066CC and the focus ring appears (section 11).
- Special fields: amounts with a ₹ prefix, right-aligned tabular figures and lakh grouping on blur; mobile with a fixed +91 prefix and a numeric keypad; 6-digit pincode; serial fields in capitals with autocorrect and autocomplete off; dates shown as DD MMM YYYY.
- Validate on blur, then on every change once a field has an error. On submit, focus the first invalid field.

### Tables

- Callout text; headers in Footnote semibold #66666B, sentence case; rows 44 px high with 1 px #E5E5EA separators; hover row #F5F5F7.
- Numbers right-aligned in tabular figures; status shown as badges; the first column links to the record; sticky header; sortable columns show their direction; 25 rows per page.
- Below `md`, rows become stacked cards: title, two or three key facts and the status badge.
- Profit table: loss-making rows get the danger badge tint with the profit in #D70015; rows below 15% margin get the warning tint.

### Badges

Pill shape, Caption in medium, 2 px × 8 px padding, tinted background with the dark text variant, optionally a 6 px dot in the base colour. Badges sit on white surfaces (cards and tables).

| Meaning | Colour | Examples |
|---|---|---|
| Done, healthy | Success | Approved, Accepted, Won, Paid, Commissioned, In warranty, Customer confirmed, Disbursed |
| Moving, waiting on us | Info | New, Contacted, Qualified, Scheduled, Sent, Confirmed, Dispatched, Delivered, In progress, Issued |
| Needs attention | Warning | Uncontacted 1h, To schedule, Submitted (needs review), Pending payment, Resolved (awaiting customer), Partly paid, Low stock, Expiring soon |
| Blocked, late, failed | Danger | Uncontacted 2h, Survey rejected, Overdue, Out of warranty, Out of stock, Loss |
| Inactive, finished | Neutral | Draft, Superseded, Expired quote, Declined, Lost, Rejected, Cancelled, Closed |

### Cards

- White surface, 16 px radius, card shadow, 20–24 px padding.
- Header: Headline title, optional Footnote description, actions on the right.
- **KPI card:** label in Footnote secondary; value in Title 1 with tabular figures; change against the previous period in Caption with an arrow icon, in success or danger text.

### Empty, loading and error states

- **Empty:** centred in the card: a 20 px icon in a 40 px #F5F5F7 circle, a Headline title, one sentence in Callout secondary and one primary action. Example: "No leads yet. New enquiries from the website appear here automatically." [Add lead]
- **No results:** "No results for these filters" with Clear filters.
- **Loading:** skeleton blocks in #E5E5EA matching the final layout; no spinners for whole pages.
- **Error:** "Couldn't load leads" with a short reason and Retry.

### Toasts

- Bottom-right on desktop, top-centre on mobile; elevated shadow; 16 px radius; one-line title plus an optional description and one action (for example "View invoice").
- Success messages say what happened, in the past tense: "Payment of ₹50,000 recorded". They close after 4 seconds.
- Errors say what went wrong and how to fix it: "Scan every serial before dispatch: 1 of 8 left". They stay until dismissed.
- Announced with `aria-live` (polite for success, assertive for errors).

### Command palette (⌘K)

Elevated card about 640 px wide with a 16 px radius; Body-size input; results grouped under Footnote headers (Customers, Serials, Leads, Quotes, Orders, Tickets, Invoices); ↑ and ↓ to move, Enter to open, Esc to close; recent records shown before typing.

### Charts

Recharts. Invoiced series #0071E3, cash series #EB6834, gridlines #E5E5EA, axis labels in Caption #66666B, ₹ axis values in compact form (₹5 L); tooltips use the elevated style; status colours only when the series means a status. No 3D charts and no pie charts with more than five slices.

## 10. Content style

- **Sentence case everywhere:** titles, buttons, navigation, table headers ("Create quote", not "Create Quote").
- **Buttons start with a verb and name the object:** "Record payment", not "Submit".
- **Money:** ₹ with lakh grouping (₹1,50,000; ₹12,34,567); compact on KPI cards and chart axes (₹18.6 L, ₹1.2 Cr); whole rupees in lists, paise only on invoices; negatives with a minus sign in danger text (−₹6,400).
- **Dates and times:** DD MMM YYYY (31 Oct 2026); with a time, "31 Oct 2026, 10:30 AM"; recent activity as relative time ("2 h ago") with the full date on hover; IST everywhere.
- **Units:** a space before units ("3 kW", "545 Wp", "12 m"); none before % or ° ("15%", "18°").
- **Phone numbers:** "+91 98480 12345". **Document numbers** exactly as issued: SP-Q-0142.
- **Voice:** plain, polite Indian English; speak to the user as "you"; no jargon on public pages ("solar panels", not "PV modules"); never blame the user.

## 11. Accessibility

Target: **WCAG 2.2 AA**.

- **Contrast:** text at least 4.5:1, large text (24 px, or 18.66 px bold) at least 3:1, meaningful icons and component boundaries at least 3:1.
- **Focus:** every focusable element shows a **solid 2 px #0066CC ring with a 2 px offset** on `:focus-visible`. Outlines are never removed without this replacement.
- **Touch targets:** at least **44 × 44 px on technician mobile screens** (and every touch layout), with 8 px between adjacent targets.
- **Forms:** every input has a visible label; errors are linked with `aria-describedby`; the first invalid field takes focus on submit.
- **Keyboard:** everything is reachable in a logical order; ⌘K or Ctrl+K opens search; Esc closes dialogs; focus is trapped inside dialogs and returned on close.
- **Screen readers:** landmarks and a unique title on every page; `lang="en-IN"`; `aria-live` for toasts and scan results; alt text on photos ("Roof photo 2 of 3, job SP-J-0087").
- **Motion:** honour `prefers-reduced-motion` (section 8).

### Contrast check (measured)

Re-measured 31 Oct, 22:45 against the tokens in `src/app/globals.css` (WCAG 2.x relative luminance; badge tints are 12% of the base colour over white).

| Pair | Ratio | Result |
|---|---|---|
| Ink on surface / on background | 16.8:1 / 15.5:1 | Pass |
| Secondary text #66666B on surface / on background | 5.7:1 / 5.2:1 | Pass |
| White on primary #0066CC | 5.6:1 | Pass |
| Primary text on surface / on background | 5.6:1 / 5.1:1 | Pass |
| Badge text on its tint, over white: info / warning #A64A00 / danger | 6.5:1 / 5.3:1 / 4.6:1 | Pass |
| Success text #17732F on its tint / on white | 5.4:1 / 5.9:1 | Pass |
| Neutral badge (#66666B on #F5F5F7) | 5.2:1 | Pass |
| Focus ring (solid #0066CC) against white | 5.6:1 | Pass |
| Input border #86868B against white | 3.6:1 | Pass |

### Known gaps and mitigations

1. **Resolved 31 Oct (AA pass):** primary is now **#0066CC**, so links and badges pass on the grey canvas too (5.1:1, was 4.3:1). Secondary text moved from #6E6E73 to **#66666B**, success text to **#17732F** and warning text to **#A64A00**.
2. **Resolved 31 Oct:** the focus ring is **solid** (now #0066CC, 5.6:1) instead of 40% opacity (1.8:1).
3. **Resolved 31 Oct:** the input border is now **#86868B** (3.6:1, WCAG 1.4.11), the same border apple.com uses on its fields.
4. **Open:** primary and primary hover are now the same colour, so a primary button has no hover change, only the 90% pressed state.

## 12. Responsive behaviour

| Breakpoint | Min width | Layout |
|---|---|---|
| Base | 0 | Single column; sidebar becomes a drawer; tables become stacked cards; sticky bottom action bar on technician forms |
| `sm` | 640 px | Two-up cards; wider dialogs |
| `md` | 768 px | Tables return; two-column forms |
| `lg` | 1024 px | Persistent sidebar; detail pages gain a side panel |
| `xl` | 1280 px | Dashboard shows three or four KPI columns |

- **Technician screens are mobile-first:** `/my-work`, `/surveys/[id]`, `/jobs/[id]`, `/service/[id]` and the `/dispatch/[orderId]` scanner are designed at 360–414 px for one-handed use, with full-width camera, photo and signature areas.
- **Test widths:** 360, 768, 1024 and 1440 px, plus a real Android phone in Chrome for camera scanning.
