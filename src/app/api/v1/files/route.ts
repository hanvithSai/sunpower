/**
 * POST /api/v1/files: one-shot upload for files up to 4 MB.
 *
 *   multipart/form-data: file=<binary>, kind=image|video (optional)
 *   201 { id, filename, contentType, size, kind }
 *
 * Vercel rejects request bodies over 4.5 MB before our code runs, so this
 * endpoint only takes files up to 4 MB (plus multipart overhead). Photos are
 * compressed in the browser first (about 1600 px JPEG, a few hundred KB), so
 * nearly every photo comes through here. Larger videos use the chunked API at
 * /api/v1/files/uploads.
 *
 * Uploads use a route handler, not a Server Action, because Server Action
 * bodies are capped at 1 MB and route handlers let the browser report progress
 * through XMLHttpRequest. The body is read with a hard byte limit before
 * multipart parsing, so an oversized or never-ending request can't exhaust
 * memory (this matters locally too, where there is no platform cap).
 */
import { AppError } from "@/server/errors";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import {
  DIRECT_UPLOAD_MAX_BYTES,
  getFileInfo,
  kindOf,
  readRequestBytes,
  saveSmallFile,
} from "@/server/services/core/files";

/** Room for the multipart boundary, part headers and the `kind` field. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const TOO_LARGE = "Files over 4 MB must be sent in pieces through /api/v1/files/uploads.";

export const maxDuration = 60;

export const POST = apiHandler(async (request) => {
  const user = await requireApiUser();

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new AppError("BAD_REQUEST", 'Send the file as multipart/form-data with a "file" field.');
  }

  const body = await readRequestBytes(request, DIRECT_UPLOAD_MAX_BYTES + MULTIPART_OVERHEAD_BYTES, TOO_LARGE);
  let form: FormData;
  try {
    form = await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new AppError("BAD_REQUEST", "The upload form data could not be read. Please try again.");
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    throw new AppError("VALIDATION", "Choose a file to upload.", { file: "A file is required" });
  }
  if (file.size > DIRECT_UPLOAD_MAX_BYTES) {
    throw new AppError("VALIDATION", TOO_LARGE, { file: "Too large for a direct upload" });
  }

  const kindField = form.get("kind");
  const requestedKind = typeof kindField === "string" && kindField !== "" ? kindField : undefined;
  if (requestedKind !== undefined && requestedKind !== "image" && requestedKind !== "video") {
    throw new AppError("VALIDATION", 'kind must be "image" or "video".', { kind: "Invalid kind" });
  }

  const id = await saveSmallFile({
    data: Buffer.from(await file.arrayBuffer()),
    filename: file.name,
    contentType: file.type,
    // An unsupported type is rejected inside saveSmallFile with a clear message.
    kind: requestedKind ?? kindOf(file.type) ?? "image",
    uploadedBy: user.id,
  });

  const info = await getFileInfo(id);
  if (!info) throw new Error(`Uploaded file ${id} could not be read back`);
  return Response.json(
    { id: info.id, filename: info.filename, contentType: info.contentType, size: info.size, kind: info.kind },
    { status: 201 },
  );
});
