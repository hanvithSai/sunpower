/**
 * Crew choice (BR-07), pure. An installation needs three installers with no
 * other job that day. Starting from the preferred day we look day by day
 * (skipping Sundays) for the first day with enough free installers, and take
 * the least-loaded of them so work spreads across the whole team. If nobody is
 * free for two weeks we fall back to the least-loaded crew on the preferred
 * day and flag the double booking (it shows on the crew calendar).
 */
import { addDays } from "./dates";

export const CREW_SIZE = 3;
export const CREW_SEARCH_DAYS = 14;

/** `dayStart` is an IST midnight (18:30 UTC the day before); +12 h lands on the same IST calendar day. */
export function isSundayIST(dayStart: Date): boolean {
  return new Date(dayStart.getTime() + 12 * 3_600_000).getUTCDay() === 0;
}

export function chooseCrew<T extends { _id: unknown; name: string }>(
  installers: T[],
  opts: {
    /** IST midnight of the preferred day. */
    firstDay: Date;
    /** Open jobs per installer id, across all dates. */
    load: Map<string, number>;
    /** Installer ids already booked on the IST day starting at `dayStart`. */
    busyOn: (dayStart: Date) => Set<string>;
    size?: number;
    searchDays?: number;
  },
): { crew: T[]; day: Date; doubleBooked: boolean } {
  const { firstDay, load, busyOn, searchDays = CREW_SEARCH_DAYS } = opts;
  const byLoad = [...installers].sort(
    (a, b) => (load.get(String(a._id)) ?? 0) - (load.get(String(b._id)) ?? 0) || a.name.localeCompare(b.name),
  );
  const size = Math.min(opts.size ?? CREW_SIZE, installers.length);
  if (size === 0) return { crew: [], day: firstDay, doubleBooked: false };

  for (let d = 0; d < searchDays; d++) {
    const day = addDays(firstDay, d);
    if (isSundayIST(day)) continue;
    const busy = busyOn(day);
    const free = byLoad.filter((i) => !busy.has(String(i._id)));
    if (free.length >= size) return { crew: free.slice(0, size), day, doubleBooked: false };
  }
  return { crew: byLoad.slice(0, size), day: firstDay, doubleBooked: true };
}
