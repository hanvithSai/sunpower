/**
 * Sidebar navigation, quick actions and role-based landing pages.
 *
 * The sidebar follows the life of a solar project — win the customer, sell
 * the system, deliver and install it, look after it, and run the business —
 * so every page shows where it sits in that journey. Each item carries a
 * one-line purpose (`hint`) for tooltips and the collapsed sidebar.
 *
 * Client components import this directly (icons are components and cannot be
 * passed from server to client as props). Admin (the Director) sees everything.
 */
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  Contact,
  FileText,
  Headset,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PackagePlus,
  Plus,
  ReceiptIndianRupee,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  UserRoundSearch,
  Users,
  Wrench,
} from "lucide-react";
import type { Role } from "./constants";

export type NavItem = { label: string; href: string; icon: LucideIcon; roles: Role[]; hint: string };
export type NavSection = { title: string; items: NavItem[] };

const STAFF: Role[] = ["admin", "sales", "technician", "warehouse", "support"];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"], hint: "What's happening across the business right now" },
      { label: "My work", href: "/my-work", icon: Sun, roles: ["technician"], hint: "Your surveys, installations and service visits" },
    ],
  },
  {
    title: "Customer acquisition",
    items: [
      { label: "Leads", href: "/leads", icon: UserRoundSearch, roles: ["admin", "sales", "support"], hint: "Every enquiry, from first call to qualified" },
      { label: "Surveys", href: "/surveys", icon: ClipboardCheck, roles: ["admin", "sales", "technician"], hint: "Roof surveys; approval unlocks quoting" },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Quotes", href: "/quotes", icon: FileText, roles: ["admin", "sales"], hint: "Systems with every part, GST and subsidy" },
      { label: "Orders", href: "/orders", icon: ShoppingCart, roles: ["admin", "sales", "warehouse"], hint: "Accepted quotes, payments and progress" },
      { label: "Catalog", href: "/catalog", icon: Package, roles: ["admin", "sales", "warehouse"], hint: "Products, packages, prices and margins" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Inventory", href: "/inventory", icon: Boxes, roles: ["admin", "warehouse"], hint: "Stock on hand, reserved and its value" },
      { label: "Goods receipts", href: "/inventory/purchases", icon: PackagePlus, roles: ["admin", "warehouse"], hint: "Receive stock and register serial numbers" },
      { label: "Serial register", href: "/inventory/serials", icon: ScanBarcode, roles: ["admin", "warehouse"], hint: "Every serialised unit and its history" },
      { label: "Dispatch", href: "/dispatch", icon: Truck, roles: ["admin", "warehouse"], hint: "Pack by scanning serials, then dispatch" },
      { label: "Installations", href: "/jobs", icon: Wrench, roles: ["admin", "sales", "technician"], hint: "Crew calendar and installation jobs" },
    ],
  },
  {
    title: "After-sales",
    items: [
      { label: "Service desk", href: "/service", icon: Headset, roles: ["admin", "support", "technician"], hint: "Tickets, warranty decisions and repairs" },
      { label: "Customers", href: "/customers", icon: Contact, roles: ["admin", "sales", "support"], hint: "Each customer's orders, serials and history" },
      { label: "Warranty check", href: "/warranty", icon: ShieldCheck, roles: STAFF, hint: "Look up any serial's cover" },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Invoices", href: "/invoices", icon: ReceiptIndianRupee, roles: ["admin", "sales"], hint: "GST invoices, dues and CSV export" },
      { label: "Subsidy", href: "/subsidy", icon: Landmark, roles: ["admin", "sales"], hint: "PM Surya Ghar files, stage by stage" },
      { label: "Team & payroll", href: "/team", icon: Users, roles: ["admin"], hint: "Hours logged and technician payouts" },
      { label: "Reports", href: "/reports", icon: BarChart3, roles: ["admin"], hint: "Twelve months of installations, money, sales, profit and service, with charts and CSVs" },
    ],
  },
];

export type QuickAction = { label: string; href: string; icon: LucideIcon; roles: Role[]; keywords: string };

/** Shortcuts that start a workflow; shared by the top bar's "New" menu and the ⌘K palette. */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New enquiry", href: "/leads?new=1", icon: Plus, roles: ["admin", "sales", "support"], keywords: "lead customer add create walk-in call" },
  { label: "New quote", href: "/quotes/new", icon: FileText, roles: ["admin", "sales"], keywords: "quotation estimate package price" },
  { label: "New service ticket", href: "/service/new", icon: Headset, roles: ["admin", "support", "technician"], keywords: "complaint issue repair breakdown create" },
  { label: "Receive stock (GRN)", href: "/inventory/purchases/new", icon: PackagePlus, roles: ["admin", "warehouse"], keywords: "goods receipt purchase inward serials" },
  { label: "Check warranty", href: "/warranty", icon: ShieldCheck, roles: STAFF, keywords: "serial lookup guarantee coverage" },
];

export function canAccess(role: Role, roles: readonly Role[]): boolean {
  return role === "admin" || roles.includes(role);
}

/** Sections filtered to what this role may open (empty sections removed). */
export function navForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccess(role, item.roles)),
  })).filter((section) => section.items.length > 0);
}

/**
 * The nav item for a page: the longest href that matches, so /inventory/serials
 * highlights "Serial register" rather than "Inventory". In-page anchors never match.
 */
export function activeNavItem(pathname: string, sections: NavSection[]): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href.includes("#")) continue;
      const hit = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (hit && (!best || item.href.length > best.item.href.length)) best = { section, item };
    }
  }
  return best;
}

/** Where each role lands after login. */
export function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "sales":
      return "/leads";
    case "technician":
      return "/my-work";
    case "warehouse":
      return "/dispatch";
    case "support":
      return "/service";
  }
}
