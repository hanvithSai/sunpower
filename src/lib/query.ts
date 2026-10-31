/**
 * Query-string helpers for server-rendered filters and toggles: build a link
 * that changes one or two params while keeping the rest of the URL.
 */
export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** First value of a possibly repeated search param. */
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `hrefWith("/leads", sp, { view: "table", page: undefined })` — undefined removes a param. */
export function hrefWith(pathname: string, current: SearchParamsRecord, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const v = first(value);
    if (v !== undefined && v !== "") params.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
