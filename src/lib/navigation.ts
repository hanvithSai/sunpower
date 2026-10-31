/**
 * Sidebar navigation and role-based landing pages.
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
  ReceiptIndianRupee,
  ShoppingCart,
  Truck,
  UserRoundSearch,
  Users,
  Wrench,
  Sun,
} from "lucide-react";
import type { Role } from "./constants";

export type NavItem = { label: string; href: string; icon: LucideIcon; roles: Role[] };
export type NavSection = { title: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
      { label: "My work", href: "/my-work", icon: Sun, roles: ["technician"] },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Customers", href: "/customers", icon: Contact, roles: ["admin", "sales", "support"] },
      { label: "Leads", href: "/leads", icon: UserRoundSearch, roles: ["admin", "sales", "support"] },
      { label: "Surveys", href: "/surveys", icon: ClipboardCheck, roles: ["admin", "sales", "technician"] },
      { label: "Quotes", href: "/quotes", icon: FileText, roles: ["admin", "sales"] },
      { label: "Orders", href: "/orders", icon: ShoppingCart, roles: ["admin", "sales", "warehouse"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Inventory", href: "/inventory", icon: Boxes, roles: ["admin", "warehouse"] },
      { label: "Dispatch", href: "/dispatch", icon: Truck, roles: ["admin", "warehouse"] },
      { label: "Installations", href: "/jobs", icon: Wrench, roles: ["admin", "sales", "technician"] },
    ],
  },
  {
    title: "Service",
    items: [{ label: "Tickets", href: "/service", icon: Headset, roles: ["admin", "support", "technician"] }],
  },
  {
    title: "Finance",
    items: [
      { label: "Invoices", href: "/invoices", icon: ReceiptIndianRupee, roles: ["admin", "sales"] },
      { label: "Subsidy", href: "/subsidy", icon: Landmark, roles: ["admin", "sales"] },
      { label: "Team & payroll", href: "/team", icon: Users, roles: ["admin"] },
    ],
  },
  {
    title: "Setup",
    items: [
      { label: "Catalog", href: "/catalog", icon: Package, roles: ["admin", "sales", "warehouse"] },
      { label: "Reports", href: "/dashboard#reports", icon: BarChart3, roles: ["admin"] },
    ],
  },
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
