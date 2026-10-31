/**
 * GET/HEAD /api/v1/files/{id}: stream a stored photo or video out of GridFS.
 *
 * - Signed-in users, or a customer holding a certificate link (?share=token)
 *   for that installation's own photos. The session is read before any I/O, as Cache
 *   Components requires.
 * - Streams chunk by chunk (Node GridFS stream -> web ReadableStream), so a
 *   50 MB video never sits in server memory, and stops reading (and frees the
 *   Mongo cursor) when the viewer goes away.
 * - Supports `Range: bytes=…` with 206 + Content-Range. iOS Safari won't play a
 *   <video> at all unless the server honours ranges, and ranges are also what
 *   make seeking work. GridFS can start reading at any byte offset because every
 *   chunk except the last is exactly 255 KiB.
 * - File ids never change content, so responses are `immutable` for a year
 *   (private: the browser may cache them, shared caches may not) and carry an
 *   ETag for cheap 304s.
 * - Only allow-listed media types are served inline, with `nosniff`, so
 *   uploaded bytes can never be rendered as HTML on our origin.
 */
import { AppError } from "@/server/errors";
import { getCurrentUser } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { apiHandler, type HandlerContext } from "@/server/lib/api";
import { getFileInfo, isAllowedType, openFileStream, type FileInfo } from "@/server/services/core/files";
import { shareLinkAllowsFile } from "@/server/services/finance";

type Params = { id: string };
type ByteRange = { start: number; end: number };

export const maxDuration = 60;

export const GET = apiHandler<Params>((request, context) => serveFile(request, context, true));

// Explicit HEAD so probing a video's size doesn't open a GridFS cursor.
export const HEAD = apiHandler<Params>((request, context) => serveFile(request, context, false));

async function serveFile(request: Request, { params }: HandlerContext<Params>, withBody: boolean): Promise<Response> {
  const user = await getCurrentUser(); // request data (cookies) first, then I/O
  const { id } = await params;
  if (!user) {
    // A customer's certificate link (?share=token) may show that installation's own photos, nothing else.
    const token = new URL(request.url).searchParams.get("share");
    if (!token || !(await shareLinkAllowsFile(token, id, new Date()))) throw new AppError("UNAUTHORIZED", "Sign in required");
  }
  await connectDB();

  const info = await getFileInfo(id);
  if (!info) throw new AppError("NOT_FOUND", "File not found");

  const etag = `"${info.id}"`;
  const cacheHeaders = {
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: etag,
    "Last-Modified": info.uploadedAt.toUTCString(),
  };

  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  const range = parseRange(request.headers.get("range"), info.size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...cacheHeaders, "Accept-Ranges": "bytes", "Content-Range": `bytes */${info.size}` },
    });
  }

  const headers = new Headers({ ...cacheHeaders, ...contentHeaders(info), "Accept-Ranges": "bytes" });
  if (range) {
    headers.set("Content-Length", String(range.end - range.start + 1));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
  } else {
    headers.set("Content-Length", String(info.size));
  }
  const status = range ? 206 : 200;
  if (!withBody) return new Response(null, { status, headers });

  const stream = await openFileStream(info.id, range ?? undefined);
  return new Response(toWebStream(stream), { status, headers });
}

function contentHeaders(info: FileInfo): Record<string, string> {
  // Anything outside the upload allow-list (e.g. a file written by another tool) downloads instead of rendering.
  const safe = isAllowedType(info.contentType);
  return {
    "Content-Type": safe ? info.contentType : "application/octet-stream",
    "Content-Disposition": contentDisposition(safe ? "inline" : "attachment", info.filename),
    "X-Content-Type-Options": "nosniff",
  };
}

/** RFC 6266 header with an ASCII fallback plus the UTF-8 name (Telugu/Hindi file names survive). */
function contentDisposition(disposition: "inline" | "attachment", filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((tag) => {
    const value = tag.trim();
    return value === "*" || value.replace(/^W\//, "") === etag;
  });
}

/**
 * Parse a single `bytes=` range (RFC 9110 §14). Multi-range or malformed headers
 * are ignored (the whole file is sent with 200), which the spec allows.
 * Returns an inclusive range, "unsatisfiable" (416), or null.
 */
function parseRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  if (!header || size <= 0) return null;
  const match = /^bytes=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header.trim());
  if (!match) return null;
  const [, first, last] = match;
  if (!first && !last) return null;

  if (!first) {
    // Suffix range: the last N bytes.
    const suffix = Number(last);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(first);
  if (last && Number(last) < start) return null; // "bytes=9-3" is invalid -> ignore the header
  if (start >= size) return "unsatisfiable";
  return { start, end: last ? Math.min(Number(last), size - 1) : size - 1 };
}

/**
 * Node GridFS stream -> web ReadableStream with backpressure: a chunk is only
 * read from Mongo when the client is ready for it. If the client disconnects
 * (closed tab, video scrubbed elsewhere), `cancel` aborts the download and
 * closes the cursor instead of leaving it open on the server.
 */
function toWebStream(source: Awaited<ReturnType<typeof openFileStream>>): ReadableStream<Uint8Array> {
  const chunks = source[Symbol.asyncIterator]() as AsyncIterator<Uint8Array>;
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await chunks.next();
        if (cancelled) return;
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        if (cancelled) return;
        console.error("[files] GridFS stream failed", error);
        controller.error(error);
      }
    },
    async cancel() {
      cancelled = true;
      await source.abort().catch(() => undefined);
    },
  });
}
