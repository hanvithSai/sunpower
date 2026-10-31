"use client";

/**
 * Global ⌘K / Ctrl+K command palette — support's "find anything in one keystroke".
 *
 * - Empty query: role-aware quick actions and "Go to" pages from navForRole(role).
 * - 2+ characters: debounced (200 ms) GET /api/v1/search?q=… → SearchResponse, grouped by
 *   SEARCH_TYPE_LABELS, each result showing its badge (e.g. "In warranty"), coloured from
 *   STATUS_META where the text matches a known status. Matching pages/actions stay listed.
 * - Network failures and non-200 responses show a calm inline message; navigation still works.
 * Selecting a result calls router.push(href) and closes the palette.
 * Analytics: search_performed (result count) and search_result_opened (record type); the query text is never sent.
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Barcode,
  FileText,
  Headset,
  LoaderCircle,
  PackagePlus,
  Plus,
  ReceiptIndianRupee,
  SearchX,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  UserRoundSearch,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { track } from "@/lib/analytics-client";
import { STATUS_META, type Role, type StatusKind, type Tone } from "@/lib/constants";
import { canAccess, navForRole } from "@/lib/navigation";
import { SEARCH_TYPE_LABELS, type SearchResponse, type SearchResult, type SearchResultType } from "@/lib/search";
import { Badge } from "@/components/ui/badge";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

type QuickAction = { label: string; href: string; icon: LucideIcon; roles: Role[]; keywords: string };

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New enquiry",
    href: "/leads?new=1",
    icon: Plus,
    roles: ["admin", "sales", "support"],
    keywords: "lead customer add create walk-in call",
  },
  {
    label: "New service ticket",
    href: "/service/new",
    icon: Headset,
    roles: ["admin", "support", "technician"],
    keywords: "complaint issue repair breakdown create",
  },
  {
    label: "Receive stock (GRN)",
    href: "/inventory/purchases/new",
    icon: PackagePlus,
    roles: ["admin", "warehouse"],
    keywords: "goods receipt purchase inward serials",
  },
  {
    label: "Check warranty",
    href: "/warranty",
    icon: ShieldCheck,
    roles: ["admin", "sales", "technician", "warehouse", "support"],
    keywords: "serial lookup guarantee coverage",
  },
];

const TYPE_ICONS: Record<SearchResultType, LucideIcon> = {
  customer: UserRound,
  lead: UserRoundSearch,
  quote: FileText,
  order: ShoppingCart,
  serial: Barcode,
  ticket: Headset,
  invoice: ReceiptIndianRupee,
};

/** Which status vocabularies a result's badge text may come from, in priority order. */
const TYPE_STATUS_KINDS: Record<SearchResultType, StatusKind[]> = {
  customer: [],
  lead: ["lead"],
  quote: ["quote"],
  order: ["order", "payment"],
  serial: ["warranty", "serial"],
  ticket: ["ticket", "priority"],
  invoice: ["invoice", "payment"],
};

/** Colour a badge by matching its text ("In warranty · 6 months left") to a known status label. */
function badgeTone(type: SearchResultType, badge: string): Tone {
  const text = badge.trim().toLowerCase();
  for (const kind of TYPE_STATUS_KINDS[type]) {
    const metas = Object.values(STATUS_META[kind]) as { label: string; tone: Tone }[];
    const match = [...metas]
      .sort((a, b) => b.label.length - a.label.length)
      .find((meta) => text.startsWith(meta.label.toLowerCase()));
    if (match) return match.tone;
  }
  return "neutral";
}

type SearchStatus = "idle" | "loading" | "done" | "error";

const SEARCH_TYPES = Object.keys(SEARCH_TYPE_LABELS) as SearchResultType[];

/** cmdk item value for a search result (unique across types). */
function resultValue(result: SearchResult): string {
  return `${result.type}:${result.id}`;
}

export type CommandPaletteProps = {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ role, open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  // Controlled highlight, so the top record is selected when async results land.
  const [selected, setSelected] = useState("");
  const debounceTimer = useRef<number | undefined>(undefined);
  const inflight = useRef<AbortController | null>(null);

  function cancelPending() {
    window.clearTimeout(debounceTimer.current);
    inflight.current?.abort();
    inflight.current = null;
  }

  function setOpen(next: boolean) {
    if (!next) {
      cancelPending();
      setQuery("");
      setResults([]);
      setStatus("idle");
      setSelected("");
    }
    onOpenChange(next);
  }

  // ⌘K / Ctrl+K toggles the palette from anywhere in the app.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    // Browser autofill fires synthetic keydown events without a `key`.
    if (typeof event.key !== "string" || event.key.toLowerCase() !== "k") return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    event.preventDefault();
    setOpen(!open);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  async function search(term: string) {
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const response = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Search responded ${response.status}`);
      const data = (await response.json()) as Partial<SearchResponse> | null;
      if (controller.signal.aborted) return;
      const found = Array.isArray(data?.results) ? data.results : [];
      setResults(found);
      setStatus("done");
      track("search_performed", { resultCount: found.length });
      const top = SEARCH_TYPES.map((type) => found.find((result) => result.type === type)).find(Boolean);
      if (top) setSelected(resultValue(top));
    } catch {
      if (controller.signal.aborted) return;
      setResults([]);
      setStatus("error");
    }
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    cancelPending();
    const term = next.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    debounceTimer.current = window.setTimeout(() => void search(term), DEBOUNCE_MS);
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  /* ---------------------------------------------------------------- */
  /* What to show                                                      */
  /* ---------------------------------------------------------------- */

  const term = query.trim();
  const needle = term.toLowerCase();
  const isSearching = term.length >= MIN_QUERY_LENGTH;

  const actions = QUICK_ACTIONS.filter((action) => canAccess(role, action.roles));
  const pages = navForRole(role).flatMap((section) =>
    section.items.map((item) => ({ ...item, section: section.title })),
  );
  const visibleActions = needle
    ? actions.filter((action) => `${action.label} ${action.keywords}`.toLowerCase().includes(needle))
    : actions;
  const visiblePages = needle
    ? pages.filter((page) => `${page.label} ${page.section}`.toLowerCase().includes(needle))
    : pages;

  const groupedResults = SEARCH_TYPES
    .map((type) => ({ type, items: results.filter((result) => result.type === type) }))
    .filter((group) => group.items.length > 0);

  const nothingFound =
    isSearching && status === "done" && results.length === 0 && visibleActions.length === 0 && visiblePages.length === 0;

  const announcement =
    status === "loading"
      ? "Searching…"
      : status === "error"
        ? "Search is unavailable right now."
        : status === "done"
          ? `${results.length} ${results.length === 1 ? "record" : "records"} found.`
          : "";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search SunPower OS"
      description="Find customers, leads, serial numbers, orders, tickets and invoices, or jump to a page."
      commandProps={{
        shouldFilter: false,
        loop: true,
        // cmdk's Ctrl+K "move up" binding would fight the Ctrl+K open/close shortcut.
        vimBindings: false,
        label: "Search SunPower OS",
        value: selected,
        onValueChange: setSelected,
      }}
    >
      <CommandInput
        value={query}
        onValueChange={handleQueryChange}
        placeholder="Search customers, serials, orders…"
        aria-describedby="command-palette-hint"
      />
      <span id="command-palette-hint" className="sr-only">
        Type at least two characters to search records. Use the arrow keys to move and Enter to open.
      </span>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <CommandList>
        {isSearching && status === "loading" && results.length === 0 ? (
          <div className="flex items-center gap-2.5 px-3 py-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Searching records…
          </div>
        ) : null}

        {isSearching && status === "error" ? (
          <div className="flex items-start gap-2.5 px-3 py-3 text-sm text-muted-foreground">
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Search is unavailable right now. You can still jump to any page below.</span>
          </div>
        ) : null}

        {nothingFound ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-foreground">No matches for “{term}”</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Try a phone number, the last digits of a serial, or a document number.
            </p>
          </div>
        ) : null}

        {isSearching
          ? groupedResults.map((group) => {
              const TypeIcon = TYPE_ICONS[group.type];
              return (
                <CommandGroup key={group.type} heading={SEARCH_TYPE_LABELS[group.type]}>
                  {group.items.map((result) => (
                    <CommandItem
                      key={resultValue(result)}
                      value={resultValue(result)}
                      onSelect={() => {
                        track("search_result_opened", { type: result.type });
                        go(result.href);
                      }}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        <TypeIcon aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{result.title}</span>
                        {result.subtitle ? (
                          <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                        ) : null}
                      </span>
                      {result.badge ? (
                        <Badge variant={badgeTone(result.type, result.badge)} className="ml-2">
                          {result.badge}
                        </Badge>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })
          : null}

        {!isSearching && term.length > 0 ? (
          <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground">Keep typing to search records…</p>
        ) : null}

        {visibleActions.length > 0 ? (
          <>
            {isSearching && groupedResults.length > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading="Quick actions">
              {visibleActions.map(({ label, href, icon: Icon }) => (
                <CommandItem key={href} value={`action:${href}`} onSelect={() => go(href)}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="font-medium text-foreground">{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {visiblePages.length > 0 ? (
          <>
            {visibleActions.length > 0 || (isSearching && groupedResults.length > 0) ? <CommandSeparator /> : null}
            <CommandGroup heading="Go to">
              {visiblePages.map(({ label, href, icon: Icon, section }) => (
                <CommandItem key={href} value={`page:${href}`} onSelect={() => go(href)}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="flex-1 font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">{section}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>

      <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          to move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          to open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd>
          to close
        </span>
      </div>
    </CommandDialog>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-card px-1 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
