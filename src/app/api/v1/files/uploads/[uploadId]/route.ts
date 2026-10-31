/**
 * /api/v1/files/uploads/{uploadId}: send pieces of a chunked upload, then finish it.
 *
 *   PUT    raw bytes, Content-Type: application/octet-stream, x-piece-index: <n>
 *          200 { received, pieces }   (received = distinct pieces stored so far)
 *   POST   (no body) verify and publish the file
 *          201 { id, filename, contentType, size, kind }
 *   DELETE cancel the upload and free its chunks (204)
 *
 * Each piece stays under Vercel's 4.5 MB body cap (16 GridFS chunks =
 * 4,177,920 bytes) and is written as chunk docs n = index*16 ... index*16+15.
 * Re-sending a piece replaces it, so the browser can retry after a dropped
 * mobile connection, and POST can be retried safely too. The server only
 * buffers one piece at a time, never the whole video. Only the user who started
 * an upload can add to, finish or cancel it.
 */
import { AppError } from "@/server/errors";
import { apiHandler, requireApiUser } from "@/server/lib/api";
import { PIECE_BYTES, abortUpload, completeUpload, readRequestBytes, writePiece } from "@/server/services/core/files";

type Params = { uploadId: string };

export const maxDuration = 60;

export const PUT = apiHandler<Params>(async (request, { params }) => {
  const user = await requireApiUser();
  const { uploadId } = await params;

  const indexHeader = request.headers.get("x-piece-index")?.trim() ?? "";
  if (!/^\d{1,6}$/.test(indexHeader)) {
    throw new AppError("BAD_REQUEST", "Send the piece number (0, 1, 2 …) in the x-piece-index header.");
  }
  const contentType = request.headers.get("content-type");
  if (contentType && !/^application\/octet-stream\b/i.test(contentType)) {
    throw new AppError("BAD_REQUEST", "Send the piece as raw bytes with Content-Type: application/octet-stream.");
  }

  const data = await readRequestBytes(request, PIECE_BYTES, `Each piece must be at most ${PIECE_BYTES} bytes.`);
  const result = await writePiece(uploadId, Number(indexHeader), data, user.id);
  return Response.json(result);
});

export const POST = apiHandler<Params>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { uploadId } = await params;
  const info = await completeUpload(uploadId, user.id);
  return Response.json(
    { id: info.id, filename: info.filename, contentType: info.contentType, size: info.size, kind: info.kind },
    { status: 201 },
  );
});

export const DELETE = apiHandler<Params>(async (_request, { params }) => {
  const user = await requireApiUser();
  const { uploadId } = await params;
  await abortUpload(uploadId, user.id);
  return new Response(null, { status: 204 });
});
