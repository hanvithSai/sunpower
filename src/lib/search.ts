/**
 * Contract for the global ⌘K search: GET /api/v1/search?q=<text>
 * Support types a phone number, a name, a serial number or a document number
 * and lands on the right record in one keystroke.
 */
export type SearchResultType = "customer" | "lead" | "quote" | "order" | "serial" | "ticket" | "invoice";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Short status text, e.g. "In warranty" or "Open". */
  badge?: string;
};

export type SearchResponse = { results: SearchResult[] };

export const SEARCH_TYPE_LABELS: Record<SearchResultType, string> = {
  customer: "Customers",
  lead: "Leads",
  quote: "Quotes",
  order: "Orders",
  serial: "Serial numbers",
  ticket: "Tickets",
  invoice: "Invoices",
};
