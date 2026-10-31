/**
 * Media storage: roof photos, short site videos and other job evidence live in
 * MongoDB GridFS, so we don't need a separate storage vendor or account.
 *
 * Layout
 *   Bucket "media" -> collections `media.files` (one doc per file) and
 *   `media.chunks` (the bytes, 255 KiB = 261,120 bytes per chunk doc, `n` = 0, 1, 2…).
 *   Each files doc carries `metadata: { contentType, kind, uploadedBy }`.
 *
 * Why two upload paths
 *   Vercel rejects serverless request bodies over 4.5 MB. Compressed photos
 *   (~200-600 KB) and short clips under 4 MB go in one multipart request
 *   (`saveSmallFile`, which uses the driver's own upload stream). Anything bigger
 *   is sent in pieces of 16 GridFS chunks (16 x 261,120 = 4,177,920 bytes):
 *
 *     createUpload()          -> session doc in `media_uploads` (_id = upload id = future file id)
 *     writePiece(i, bytes) xN -> writes chunk docs n = i*16 ... i*16+15 straight into `media.chunks`
 *     completeUpload()        -> checks chunk count + total bytes, then inserts the `media.files` doc
 *
 *   Only the last piece may be short, and inside it only the last chunk, which
 *   is exactly the layout `GridFSBucket.openUploadStream` produces. So the
 *   standard `openDownloadStream` (including byte-range reads for video seeking)
 *   works on chunked uploads too. A file is invisible until its files doc
 *   exists, so readers never see half-uploaded data.
 *
 * Robustness
 *   - Retrying a piece first deletes that piece's chunk range, so a retry
 *     after a dropped connection never leaves duplicate or stale chunks.
 *   - Completing twice returns the same file (the first response may have been lost).
 *   - Abandoned sessions (no piece for 6 h) and their chunks are swept the next
 *     time someone starts a chunked upload. Atlas M0 has only 512 MB, which is
 *     also why videos are capped at 50 MB.
 *   - The server only holds one piece (<= 4 MB) in memory at a time, and checks
 *     magic bytes so a file's contents must match its declared type.
 *
 * This module deliberately does NOT import "server-only": the seed script
 * imports it under plain Node (tsx) to load demo photos.
 */
import mongoose from "mongoose";
import type { mongo } from "mongoose";
import { connectDB } from "@/server/db";
import { AppError, isDuplicateKeyError } from "@/server/errors";

/* ------------------------------------------------------------------ */
/* Limits and layout                                                   */
/* ------------------------------------------------------------------ */

export const BUCKET_NAME = "media";
export const UPLOADS_COLLECTION = "media_uploads";

/** GridFS chunk size: 255 KiB (the driver default). */
export const GRIDFS_CHUNK_BYTES = 255 * 1024; // 261,120
export const CHUNKS_PER_PIECE = 16;
/** Size of one piece of a chunked upload: 16 chunks = 4,177,920 bytes, safely below Vercel's 4.5 MB body cap. */
export const PIECE_BYTES = GRIDFS_CHUNK_BYTES * CHUNKS_PER_PIECE;
/** Largest file accepted by the one-shot multipart endpoint; bigger files must be chunked. */
export const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

/** Pending chunked uploads with no activity for this long are deleted. */
const STALE_UPLOAD_MS = 6 * 60 * 60 * 1000;

export type AllowedContentType = (typeof ALLOWED_TYPES)[number];
export type MediaKind = "image" | "video";

export interface FileInfo {
  id: string;
  filename: string;
  contentType: string;
  kind: MediaKind;
  size: number;
  uploadedAt: Date;
}

export interface UploadSession {
  uploadId: string;
  pieceBytes: number;
  pieces: number;
}

/* ------------------------------------------------------------------ */
/* Stored document shapes                                              */
/* ------------------------------------------------------------------ */

interface FileMetadata {
  contentType: string;
  kind: MediaKind;
  uploadedBy: string;
}

interface FileDoc {
  _id: mongo.ObjectId;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  filename: string;
  metadata?: Partial<FileMetadata>;
  /** Legacy top-level field some GridFS clients still write. */
  contentType?: string;
}

interface ChunkDoc {
  _id: mongo.ObjectId;
  files_id: mongo.ObjectId;
  n: number;
  data: mongo.Binary;
}

interface UploadDoc {
  /** The upload id, reused as the GridFS file id on completion. */
  _id: mongo.ObjectId;
  filename: string;
  contentType: AllowedContentType;
  kind: MediaKind;
  size: number;
  pieces: number;
  uploadedBy: string;
  receivedPieces: number[];
  createdAt: Date;
  updatedAt: Date;
}

type Collections = {
  files: mongo.Collection<FileDoc>;
  chunks: mongo.Collection<ChunkDoc>;
  uploads: mongo.Collection<UploadDoc>;
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const HEX_ID = /^[a-f\d]{24}$/i;
const SESSION_GONE = "This upload session has expired or was cancelled. Please start the upload again.";

function parseId(id: unknown): mongo.ObjectId | null {
  return typeof id === "string" && HEX_ID.test(id) ? new mongoose.mongo.ObjectId(id) : null;
}

function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/** "Image/JPEG; charset=x" -> "image/jpeg" (and the common "image/jpg" alias). */
export function normalizeContentType(value: unknown): string {
  const type = String(value ?? "").split(";")[0]!.trim().toLowerCase();
  return type === "image/jpg" || type === "image/pjpeg" ? "image/jpeg" : type;
}

export function isAllowedType(value: string): value is AllowedContentType {
  return (ALLOWED_TYPES as readonly string[]).includes(value);
}

/** "image" / "video" for an allowed content type, otherwise null. */
export function kindOf(contentType: string): MediaKind | null {
  const type = normalizeContentType(contentType);
  if (!isAllowedType(type)) return null;
  return type.startsWith("video/") ? "video" : "image";
}

export function maxBytesFor(kind: MediaKind): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/** Strip paths, control/reserved characters and runaway lengths from a client-supplied name. */
export function sanitizeFilename(value: unknown, kind: MediaKind = "image"): string {
  const base = String(value ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = Array.from(base.normalize("NFC"))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f && !'<>:"|?*'.includes(ch);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const name = cleaned || (kind === "video" ? "video" : "photo");
  if (name.length <= 120) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 10 ? name.slice(dot) : "";
  return name.slice(0, 120 - ext.length) + ext;
}

function requireUploader(uploadedBy: unknown): string {
  if (typeof uploadedBy !== "string" || !uploadedBy.trim() || uploadedBy.length > 64) {
    throw new AppError("BAD_REQUEST", "uploadedBy must identify the user who uploaded the file.");
  }
  return uploadedBy.trim();
}

/** Type + size checks shared by both upload paths. */
function validateMedia(input: { contentType: unknown; size: unknown; kind?: unknown }): {
  contentType: AllowedContentType;
  kind: MediaKind;
  size: number;
} {
  const contentType = normalizeContentType(input.contentType);
  if (!isAllowedType(contentType)) {
    throw new AppError(
      "VALIDATION",
      `Unsupported file type${contentType ? ` "${contentType}"` : ""}. Upload a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video.`,
      { contentType: "Unsupported file type" },
    );
  }
  const kind: MediaKind = contentType.startsWith("video/") ? "video" : "image";
  if (input.kind !== undefined && input.kind !== null && input.kind !== "" && input.kind !== kind) {
    throw new AppError("VALIDATION", `This file is ${kind === "video" ? "a video" : "an image"}, not "${String(input.kind)}".`, {
      kind: "Does not match the file type",
    });
  }
  const size = input.size;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
    throw new AppError("VALIDATION", "The file is empty.", { size: "File is empty" });
  }
  const max = maxBytesFor(kind);
  if (size > max) {
    const actual = formatMb(size) === formatMb(max) ? "" : ` (this one is ${formatMb(size)})`;
    throw new AppError("VALIDATION", `${kind === "video" ? "Videos" : "Photos"} must be ${formatMb(max)} or smaller${actual}.`, {
      size: "File is too large",
    });
  }
  return { contentType, kind, size };
}

/* ------------------------------------------------------------------ */
/* Content sniffing: the bytes must match the declared type            */
/* ------------------------------------------------------------------ */

/** Top-level boxes an MP4 / QuickTime file can start with. */
const ISO_BMFF_BOXES = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"]);

function sniffType(head: Uint8Array): AllowedContentType | "video/iso-bmff" | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...head.subarray(start, end));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video/webm";
  if (ISO_BMFF_BOXES.has(ascii(4, 8))) return "video/iso-bmff";
  return null;
}

/**
 * Returns the content type to store. A mislabelled image (a JPEG named .png) or
 * WebM sent as MP4 is corrected, but the kind must match and unknown bytes are
 * rejected. MP4 vs MOV keeps the declared type because the two share a container.
 */
function reconcileContentType(declared: AllowedContentType, head: Uint8Array): AllowedContentType {
  const sniffed = sniffType(head);
  if (sniffed === "video/iso-bmff") {
    if (declared === "video/mp4" || declared === "video/quicktime") return declared;
  } else if (sniffed && kindOf(sniffed) === kindOf(declared)) {
    return sniffed;
  }
  throw new AppError(
    "VALIDATION",
    "The file's contents don't match its type. Upload a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video.",
    { file: "Unrecognised file contents" },
  );
}

/* ------------------------------------------------------------------ */
/* Connections and indexes                                             */
/* ------------------------------------------------------------------ */

async function getDb(): Promise<mongo.Db> {
  const connection = (await connectDB()).connection;
  const db = connection.db;
  if (!db) throw new Error("MongoDB connection is not ready");
  return db;
}

async function getCollections(): Promise<Collections> {
  const db = await getDb();
  return {
    files: db.collection<FileDoc>(`${BUCKET_NAME}.files`),
    chunks: db.collection<ChunkDoc>(`${BUCKET_NAME}.chunks`),
    uploads: db.collection<UploadDoc>(UPLOADS_COLLECTION),
  };
}

/** The standard driver bucket over `media.files` / `media.chunks`. */
export async function getBucket(): Promise<mongo.GridFSBucket> {
  const db = await getDb();
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME, chunkSizeBytes: GRIDFS_CHUNK_BYTES });
}

const indexCache = globalThis as unknown as { __sunpowerMediaIndexes?: Promise<void> };

/**
 * The driver only creates GridFS indexes from openUploadStream, and skips the
 * check once any files doc exists. Chunked uploads write chunks directly, so we
 * create the indexes ourselves (once per process). The unique (files_id, n) index
 * also stops a racing piece retry from storing a chunk twice.
 */
async function ensureIndexes(cols: Collections): Promise<void> {
  indexCache.__sunpowerMediaIndexes ??= Promise.all([
    cols.chunks.createIndex({ files_id: 1, n: 1 }, { unique: true }),
    cols.files.createIndex({ filename: 1, uploadDate: 1 }),
    cols.uploads.createIndex({ updatedAt: 1 }),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      indexCache.__sunpowerMediaIndexes = undefined; // retry on the next upload
      console.warn("[files] could not ensure GridFS indexes", error);
    });
  await indexCache.__sunpowerMediaIndexes;
}

function toFileInfo(doc: FileDoc): FileInfo {
  const contentType = normalizeContentType(doc.metadata?.contentType ?? doc.contentType ?? "application/octet-stream");
  const storedKind = doc.metadata?.kind;
  const kind: MediaKind =
    storedKind === "image" || storedKind === "video" ? storedKind : contentType.startsWith("video/") ? "video" : "image";
  return {
    id: doc._id.toHexString(),
    filename: doc.filename,
    contentType,
    kind,
    size: doc.length,
    uploadedAt: doc.uploadDate,
  };
}

/* ------------------------------------------------------------------ */
/* Request bodies                                                      */
/* ------------------------------------------------------------------ */

/**
 * Read a request body into memory, refusing anything over `maxBytes` (checked
 * against Content-Length first, then while streaming). A client that drops
 * mid-upload gets a 400 instead of a hung or half-written piece.
 */
export async function readRequestBytes(
  request: Request,
  maxBytes: number,
  tooLargeMessage?: string,
): Promise<Buffer<ArrayBuffer>> {
  const message = tooLargeMessage ?? `The request body must be ${formatMb(maxBytes)} or smaller.`;
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) throw new AppError("VALIDATION", message);
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new AppError("VALIDATION", message);
      }
      parts.push(value);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("BAD_REQUEST", "The upload was interrupted before it finished. Please try again.");
  }
  return Buffer.concat(parts, total);
}

/* ------------------------------------------------------------------ */
/* Small files (<= 4 MB through the API, any allowed size from scripts) */
/* ------------------------------------------------------------------ */

export async function saveSmallFile(input: {
  data: Buffer;
  filename: string;
  contentType: string;
  kind: MediaKind;
  uploadedBy: string;
}): Promise<string> {
  const cols = await getCollections();
  const media = validateMedia({ contentType: input.contentType, size: input.data.length, kind: input.kind });
  const contentType = reconcileContentType(media.contentType, input.data.subarray(0, 16));
  const metadata: FileMetadata = { contentType, kind: media.kind, uploadedBy: requireUploader(input.uploadedBy) };

  await ensureIndexes(cols);
  const bucket = await getBucket();
  const upload = bucket.openUploadStream(sanitizeFilename(input.filename, media.kind), {
    chunkSizeBytes: GRIDFS_CHUNK_BYTES,
    metadata,
  });
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(input.data);
  });
  return upload.id.toHexString();
}

/* ------------------------------------------------------------------ */
/* Chunked uploads                                                     */
/* ------------------------------------------------------------------ */

export async function createUpload(input: {
  filename: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  kind?: MediaKind;
}): Promise<UploadSession> {
  const cols = await getCollections();
  const media = validateMedia(input);
  const uploadedBy = requireUploader(input.uploadedBy);

  await ensureIndexes(cols);
  await cleanupStaleUploads().catch((error: unknown) => console.warn("[files] stale upload sweep failed", error));

  const now = new Date();
  const doc: UploadDoc = {
    _id: new mongoose.mongo.ObjectId(),
    filename: sanitizeFilename(input.filename, media.kind),
    contentType: media.contentType,
    kind: media.kind,
    size: media.size,
    pieces: Math.ceil(media.size / PIECE_BYTES),
    uploadedBy,
    receivedPieces: [],
    createdAt: now,
    updatedAt: now,
  };
  await cols.uploads.insertOne(doc);
  return { uploadId: doc._id.toHexString(), pieceBytes: PIECE_BYTES, pieces: doc.pieces };
}

async function findUpload(cols: Collections, uploadId: string, userId?: string): Promise<UploadDoc> {
  const _id = parseId(uploadId);
  const upload = _id ? await cols.uploads.findOne({ _id }) : null;
  if (!upload) throw new AppError("NOT_FOUND", SESSION_GONE);
  if (userId !== undefined && upload.uploadedBy !== userId) {
    throw new AppError("FORBIDDEN", "This upload belongs to another user.");
  }
  return upload;
}

/** Delete a pending session and its chunks (unless it already became a real file). */
async function discardUpload(cols: Collections, _id: mongo.ObjectId): Promise<void> {
  await cols.uploads.deleteOne({ _id });
  const completed = await cols.files.countDocuments({ _id }, { limit: 1 });
  if (!completed) await cols.chunks.deleteMany({ files_id: _id });
}

/**
 * Store piece `pieceIndex` (0-based) of a chunked upload. Every piece except the
 * last must be exactly PIECE_BYTES; the last one carries the remainder. Pass
 * `userId` to make sure only the user who started the upload can add to it.
 */
export async function writePiece(
  uploadId: string,
  pieceIndex: number,
  data: Buffer,
  userId?: string,
): Promise<{ received: number; pieces: number }> {
  const cols = await getCollections();
  const upload = await findUpload(cols, uploadId, userId);

  if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= upload.pieces) {
    throw new AppError(
      "BAD_REQUEST",
      `Piece index ${String(pieceIndex)} is out of range. This upload has pieces 0 to ${upload.pieces - 1}.`,
    );
  }
  const isLast = pieceIndex === upload.pieces - 1;
  const expected = isLast ? upload.size - PIECE_BYTES * (upload.pieces - 1) : PIECE_BYTES;
  if (data.length !== expected) {
    throw new AppError(
      "BAD_REQUEST",
      `Piece ${pieceIndex} must be exactly ${expected} bytes, but ${data.length} bytes arrived. Please retry the upload.`,
    );
  }
  const contentType = pieceIndex === 0 ? reconcileContentType(upload.contentType, data.subarray(0, 16)) : upload.contentType;

  // Piece i owns chunk docs n = i*16 ... i*16+15. Slicing shares memory (no copies).
  const firstN = pieceIndex * CHUNKS_PER_PIECE;
  const docs: ChunkDoc[] = [];
  for (let offset = 0, n = firstN; offset < data.length; offset += GRIDFS_CHUNK_BYTES, n += 1) {
    docs.push({
      _id: new mongoose.mongo.ObjectId(),
      files_id: upload._id,
      n,
      data: new mongoose.mongo.Binary(data.subarray(offset, offset + GRIDFS_CHUNK_BYTES)),
    });
  }

  // Idempotent: clear whatever an earlier (maybe half-finished) attempt left, then insert.
  const range = { files_id: upload._id, n: { $gte: firstN, $lt: firstN + CHUNKS_PER_PIECE } };
  for (let attempt = 0; ; attempt += 1) {
    await cols.chunks.deleteMany(range);
    try {
      await cols.chunks.insertMany(docs, { ordered: true });
      break;
    } catch (error) {
      // A concurrent retry of the same piece won the race; clear its chunks and replay once.
      if (!isDuplicateKeyError(error) || attempt >= 1) throw error;
    }
  }

  const updated = await cols.uploads.findOneAndUpdate(
    { _id: upload._id },
    {
      $addToSet: { receivedPieces: pieceIndex },
      $set: contentType === upload.contentType ? { updatedAt: new Date() } : { updatedAt: new Date(), contentType },
    },
    { returnDocument: "after", projection: { receivedPieces: 1, pieces: 1 } },
  );
  if (!updated) {
    // The session was cancelled or swept while we were writing: don't leave orphans behind.
    const completed = await cols.files.countDocuments({ _id: upload._id }, { limit: 1 });
    if (!completed) await cols.chunks.deleteMany({ files_id: upload._id });
    throw new AppError("NOT_FOUND", SESSION_GONE);
  }
  return { received: updated.receivedPieces.length, pieces: updated.pieces };
}

/**
 * Verify every piece arrived and the stored bytes add up to the declared size,
 * then publish the GridFS files doc. Calling it again after success returns the
 * same file.
 */
export async function completeUpload(uploadId: string, userId: string): Promise<FileInfo> {
  const cols = await getCollections();
  const _id = parseId(uploadId);
  if (!_id) throw new AppError("NOT_FOUND", SESSION_GONE);

  const upload = await cols.uploads.findOne({ _id });
  if (!upload) {
    const existing = await cols.files.findOne({ _id });
    if (existing && existing.metadata?.uploadedBy === userId) return toFileInfo(existing);
    throw new AppError("NOT_FOUND", SESSION_GONE);
  }
  if (upload.uploadedBy !== userId) throw new AppError("FORBIDDEN", "This upload belongs to another user.");

  const received = new Set(upload.receivedPieces);
  const missing = Array.from({ length: upload.pieces }, (_, i) => i).filter((i) => !received.has(i));
  if (missing.length > 0) {
    throw new AppError(
      "INVALID_STATE",
      `The upload isn't finished: ${missing.length} of ${upload.pieces} pieces are missing (first missing piece: ${missing[0]}).`,
    );
  }

  const expectedChunks = Math.ceil(upload.size / GRIDFS_CHUNK_BYTES);
  const [stats] = await cols.chunks
    .aggregate<{ count: number; bytes: number; ns: number[] }>([
      { $match: { files_id: _id } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          bytes: { $sum: { $binarySize: "$data" } },
          ns: { $addToSet: "$n" },
        },
      },
    ])
    .toArray();
  const layoutOk =
    stats !== undefined &&
    stats.count === expectedChunks &&
    stats.bytes === upload.size &&
    stats.ns.length === expectedChunks &&
    Math.min(...stats.ns) === 0 &&
    Math.max(...stats.ns) === expectedChunks - 1;
  if (!layoutOk) {
    await discardUpload(cols, _id);
    throw new AppError(
      "INVALID_STATE",
      `The uploaded data didn't add up (expected ${upload.size} bytes, stored ${stats?.bytes ?? 0}). Please upload the file again.`,
    );
  }

  const file: FileDoc = {
    _id,
    length: upload.size,
    chunkSize: GRIDFS_CHUNK_BYTES,
    uploadDate: new Date(),
    filename: upload.filename,
    metadata: { contentType: upload.contentType, kind: upload.kind, uploadedBy: upload.uploadedBy },
  };
  try {
    await cols.files.insertOne(file);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error; // a parallel "complete" already published it
  }
  await cols.uploads.deleteOne({ _id });
  const stored = await cols.files.findOne({ _id });
  return toFileInfo(stored ?? file);
}

/** Cancel a pending chunked upload (the user removed the file mid-upload). */
export async function abortUpload(uploadId: string, userId: string): Promise<void> {
  const cols = await getCollections();
  const upload = await findUpload(cols, uploadId, userId);
  await discardUpload(cols, upload._id);
}

/** Delete sessions idle for longer than `maxAgeMs` together with their chunks. Returns how many were swept. */
export async function cleanupStaleUploads(maxAgeMs: number = STALE_UPLOAD_MS): Promise<number> {
  const cols = await getCollections();
  const stale = await cols.uploads
    .find({ updatedAt: { $lt: new Date(Date.now() - maxAgeMs) } }, { projection: { _id: 1 } })
    .limit(25)
    .toArray();
  for (const { _id } of stale) await discardUpload(cols, _id);
  return stale.length;
}

/* ------------------------------------------------------------------ */
/* Reading and deleting                                                */
/* ------------------------------------------------------------------ */

/** Info for many ids, in input order (duplicates and missing/invalid ids skipped). */
export async function getFilesInfo(ids: readonly string[]): Promise<FileInfo[]> {
  const cols = await getCollections();
  const wanted = Array.from(
    new Set(ids.filter((id) => typeof id === "string" && HEX_ID.test(id)).map((id) => id.toLowerCase())),
  );
  if (wanted.length === 0) return [];
  const docs = await cols.files.find({ _id: { $in: wanted.map((id) => new mongoose.mongo.ObjectId(id)) } }).toArray();
  const byId = new Map(docs.map((doc) => [doc._id.toHexString(), doc]));
  return wanted.flatMap((id) => {
    const doc = byId.get(id);
    return doc ? [toFileInfo(doc)] : [];
  });
}

export async function getFileInfo(id: string): Promise<FileInfo | null> {
  const cols = await getCollections();
  const _id = parseId(id);
  if (!_id) return null;
  const doc = await cols.files.findOne({ _id });
  return doc ? toFileInfo(doc) : null;
}

/**
 * Stream a stored file. `range` uses HTTP semantics: `end` is INCLUSIVE and both
 * offsets must already be validated against the file size (see getFileInfo).
 * Call `stream.abort()` if the consumer goes away early, to free the cursor.
 */
export async function openFileStream(
  id: string,
  range?: { start: number; end: number },
): Promise<mongo.GridFSBucketReadStream> {
  const bucket = await getBucket();
  const _id = parseId(id);
  if (!_id) throw new AppError("NOT_FOUND", "File not found");
  if (!range) return bucket.openDownloadStream(_id);
  const { start, end } = range;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new AppError("BAD_REQUEST", "Invalid byte range");
  }
  return bucket.openDownloadStream(_id, { start, end: end + 1 }); // the driver's `end` is exclusive
}

/** Delete a file (or a pending upload with that id) and all its chunks. True if a file was removed. */
export async function deleteFile(id: string): Promise<boolean> {
  const cols = await getCollections();
  const _id = parseId(id);
  if (!_id) return false;
  const { deletedCount } = await cols.files.deleteOne({ _id });
  await cols.chunks.deleteMany({ files_id: _id });
  await cols.uploads.deleteOne({ _id });
  return deletedCount > 0;
}
