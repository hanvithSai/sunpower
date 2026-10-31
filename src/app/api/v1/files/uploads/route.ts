/**
 * POST /api/v1/files/uploads: start a chunked upload for files over 4 MB.
 *
 *   JSON { filename, contentType, size, kind? }
 *   201  { uploadId, pieceBytes, pieces }
 *
 * Vercel caps a request body at 4.5 MB, so large videos are sent as `pieces`
 * PUTs of `pieceBytes` (16 GridFS chunks = 4,177,920 bytes; only the last piece
 * is shorter) to /api/v1/files/uploads/{uploadId}, followed by one POST to the
 * same URL to finish. Type and size limits are enforced here, before any bytes
 * are sent, so a 200 MB video is rejected straight away.
 */
import { z } from "zod";
import { apiHandler, readJson, requireApiUser } from "@/server/lib/api";
import { parseInput } from "@/server/lib/validate";
import { createUpload } from "@/server/services/core/files";

const CreateUploadSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required").max(255, "Filename is too long"),
  contentType: z.string().trim().min(1, "Content type is required").max(100, "Content type is too long"),
  size: z.number().int("Size must be a whole number of bytes").positive("The file is empty"),
  kind: z.enum(["image", "video"]).optional(),
});

export const POST = apiHandler(async (request) => {
  const user = await requireApiUser();
  const input = parseInput(CreateUploadSchema, await readJson(request));
  const session = await createUpload({ ...input, uploadedBy: user.id });
  return Response.json(session, { status: 201 });
});
