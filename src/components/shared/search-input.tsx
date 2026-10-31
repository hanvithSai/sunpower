"use client";

/**
 * SearchInput — a list-page search box that writes to the URL (?q=…).
 *
 *   <SearchInput placeholder="Search name, phone or lead no." />
 *
 * Typing is debounced (300 ms), then the URL is replaced (no history spam), other
 * query params are kept and `page` is dropped so results start at page 1. The page's
 * Server Component reads `searchParams` and re-renders. Back/forward and links that
 * change the param elsewhere are reflected in the box.
 * It carries its own <Suspense> boundary because it reads `useSearchParams()`.
 */
import { Suspense, useRef, useState, useTransition, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchInputProps = {
  placeholder?: string;
  /** Query-string key to write. Defaults to "q". */
  param?: string;
};

export function SearchInput({ placeholder = "Search…", param = "q" }: SearchInputProps) {
  return (
    <Suspense fallback={<SearchField placeholder={placeholder} value="" readOnly />}>
      <UrlSearchInput placeholder={placeholder} param={param} />
    </Suspense>
  );
}

function UrlSearchInput({ placeholder, param }: Required<SearchInputProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlValue = searchParams.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  // The last value this box wrote to the URL, and the URL value we last reconciled with.
  const [sentValue, setSentValue] = useState(urlValue);
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);
  const timer = useRef<number | undefined>(undefined);

  // Adopt URL changes made elsewhere (back/forward, sidebar link) — but ignore the echo
  // of our own debounced write so we never clobber what the user is still typing.
  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);
    if (urlValue !== sentValue) {
      setValue(urlValue);
      setSentValue(urlValue);
    }
  }

  function push(next: string) {
    const term = next.trim();
    setSentValue(term);
    // Read the live URL so params changed during the debounce window are kept.
    const params = new URLSearchParams(window.location.search);
    if (term) params.set(param, term);
    else params.delete(param);
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => push(next), 300);
  }

  function handleClear() {
    window.clearTimeout(timer.current);
    setValue("");
    push("");
  }

  return (
    <SearchField
      placeholder={placeholder}
      value={value}
      pending={isPending}
      onChange={handleChange}
      onClear={value ? handleClear : undefined}
      onEscape={value ? handleClear : undefined}
    />
  );
}

type SearchFieldProps = {
  placeholder: string;
  value: string;
  pending?: boolean;
  readOnly?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  onEscape?: () => void;
};

function SearchField({ placeholder, value, pending = false, readOnly, onChange, onClear, onEscape }: SearchFieldProps) {
  return (
    <div role="search" className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "Escape" && onEscape) {
            event.preventDefault();
            onEscape();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-card pr-9 pl-9 text-sm text-foreground shadow-xs",
          "transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground/70",
          "focus-visible:border-primary pointer-coarse:h-11 pointer-coarse:text-base",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {pending ? (
          <LoaderCircle className="mr-2 size-4 animate-spin text-muted-foreground" aria-label="Searching" />
        ) : onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:size-9"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
