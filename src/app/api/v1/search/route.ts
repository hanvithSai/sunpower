/**
 * GET /api/v1/search?q=… — the ⌘K palette's record search (any signed-in
 * staff member; results are filtered by role). Contract: src/lib/search.ts.
 */
import type { SearchResponse } from "@/lib/search";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import { searchRecords } from "@/server/services/search";

export const GET = apiHandler(async (request) => {
  const user = await requireApiUser();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchRecords(q, user.role, new Date());
  return Response.json({ results } satisfies SearchResponse, { headers: { "Cache-Control": "no-store" } });
});
