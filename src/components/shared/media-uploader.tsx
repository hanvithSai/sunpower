"use client";

/**
 * <MediaUploader>: photo/video capture for technicians' phones that uploads
 * straight to GridFS and hands the stored file ids to the surrounding form.
 *
 *   <form action={completeJob}>
 *     <MediaUploader name="photos" accept="image+video" defaultValue={job.photos} />
 *   </form>
 *   // server action: formData.getAll("photos") -> ["665f…", …]
 *   //                formData.get("photos__uploading") === "1" while uploads are still running
 *
 * Why it works this way
 * - Files are uploaded as soon as they're picked, to /api/v1/files route
 *   handlers, not with the form. Server Action bodies are capped at 1 MB, and
 *   uploading early means the form submits instantly from a weak rooftop signal.
 *   The form only carries the ids (one hidden input per finished file).
 * - Photos are shrunk in the browser (longest edge 1600 px, JPEG quality 0.8,
 *   EXIF rotation applied, transparent PNGs flattened on white). That turns a
 *   4-8 MB camera photo into roughly 200-600 KB, which keeps mobile uploads fast
 *   and stays within Atlas M0's 512 MB. Originals over 10 MB are refused before
 *   decoding so low-end phones don't run out of memory.
 * - Vercel rejects request bodies over 4.5 MB. Files up to 4 MB go in one
 *   multipart POST; larger videos (up to 50 MB) go through the chunked API in
 *   pieces sized by the server (16 GridFS chunks = 4,177,920 bytes).
 *   XMLHttpRequest (not fetch) is used because it reports upload progress.
 * - Mobile networks drop out, so failed requests are retried automatically
 *   with backoff. Tapping "Retry" resumes a chunked upload at the first unsent
 *   piece instead of starting over. Removing a tile cancels its request and
 *   frees any half-uploaded chunks on the server.
 * - While anything is in flight, a hidden `${name}__uploading=1` field and an
 *   inline note tell the form, and an invisible required control makes the
 *   browser block native submit ("Please wait …") so photos aren't silently lost.
 *
 * Limits mirror src/server/services/core/files.ts (that module can't be
 * imported here: it pulls in Mongoose). The server re-validates everything.
 */

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, CircleAlert, ImageOff, ImagePlus, LoaderCircle, Play, RotateCw, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Limits (keep in sync with the server)                               */
/* ------------------------------------------------------------------ */

const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;
/** Two uploads at a time: the first photo finishes quickly instead of eight crawling together. */
const PARALLEL_UPLOADS = 2;
const AUTO_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/** Some Android pickers report an empty MIME type, so fall back to the extension. */
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MediaKind = "image" | "video";
type ItemStatus = "processing" | "uploading" | "done" | "error";

interface MediaItem {
  key: string;
  kind: MediaKind;
  status: ItemStatus;
  /** 0–100 */
  progress: number;
  previewUrl: string | null;
  fileId?: string;
  error?: string;
  /** False when retrying can't help (wrong type, too large). */
  canRetry?: boolean;
}

interface UploadedFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  kind: MediaKind;
}

interface PreparedFile {
  blob: Blob;
  filename: string;
  contentType: string;
}

/** Mutable per-file upload state, kept outside React state (never rendered). */
interface UploadTask {
  file: File;
  kind: MediaKind;
  contentType: string;
  prepared?: PreparedFile;
  session?: { uploadId: string; pieceBytes: number; pieces: number; next: number };
  controller?: AbortController;
  objectUrl?: string;
}

export interface MediaUploaderProps {
  /** Form field name: one hidden input per uploaded file id, read with formData.getAll(name). */
  name: string;
  accept?: "image" | "image+video";
  maxFiles?: number;
  /** Already-saved file ids (rendered as photos). */
  defaultValue?: string[];
  /** Open the rear camera directly on phones (capture="environment"). */
  capture?: boolean;
  label?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

let keySequence = 0;
const nextKey = () => `upload-${++keySequence}`;
const fileUrl = (id: string) => `/api/v1/files/${encodeURIComponent(id)}`;

export function MediaUploader({
  name,
  accept = "image",
  maxFiles = 8,
  defaultValue,
  capture = true,
  label,
}: MediaUploaderProps) {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef(new Map<string, UploadTask>());
  const [limiter] = useState(() => createLimiter(PARALLEL_UPLOADS));
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<MediaItem[]>(() =>
    Array.from(new Set((defaultValue ?? []).filter(Boolean))).map((id) => ({
      key: `saved-${id}`,
      kind: "image",
      status: "done",
      progress: 100,
      previewUrl: fileUrl(id),
      fileId: id,
    })),
  );

  const patchItem = useCallback((key: string, patch: Partial<MediaItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const runTask = useCallback(
    async (key: string) => {
      const task = tasksRef.current.get(key);
      if (!task) return;
      task.controller?.abort();
      const controller = new AbortController();
      task.controller = controller;
      const { signal } = controller;

      await limiter.acquire();
      try {
        if (signal.aborted) return;
        if (!task.prepared) {
          patchItem(key, { status: "processing", progress: 0, error: undefined });
          const prepared = await prepareFile(task);
          if (signal.aborted) return;
          task.prepared = prepared;
          if (task.kind === "image") {
            task.objectUrl = URL.createObjectURL(prepared.blob);
            patchItem(key, { previewUrl: task.objectUrl });
          }
        }

        patchItem(key, { status: "uploading", progress: 0, error: undefined });
        let shown = -1;
        const onProgress = (fraction: number) => {
          // Hold at 99% until the server confirms the file is saved.
          const percent = Math.max(0, Math.min(99, Math.floor(fraction * 100)));
          if (percent !== shown) {
            shown = percent;
            patchItem(key, { progress: percent });
          }
        };
        const uploaded =
          task.prepared.blob.size <= DIRECT_UPLOAD_MAX_BYTES
            ? await uploadDirect(task.prepared, task.kind, signal, onProgress)
            : await uploadChunked(task, signal, onProgress);
        if (signal.aborted) return;
        patchItem(key, { status: "done", progress: 100, fileId: uploaded.id });
      } catch (error) {
        if (signal.aborted) return;
        const failure = toUploadError(error);
        patchItem(key, { status: "error", error: failure.message, canRetry: !failure.permanent });
      } finally {
        limiter.release();
        if (task.controller === controller) task.controller = undefined;
      }
    },
    [limiter, patchItem],
  );

  // Leaving the page cancels in-flight uploads and frees preview memory.
  useEffect(() => {
    const tasks = tasksRef.current;
    return () => {
      for (const task of tasks.values()) discardTask(task);
      tasks.clear();
    };
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = Array.from(input.files ?? []);
    input.value = ""; // so picking the same file again still fires change
    if (picked.length === 0) return;

    const room = Math.max(0, maxFiles - items.length);
    const chosen = picked.slice(0, room);
    const skipped = picked.length - chosen.length;
    setNotice(skipped > 0 ? `Up to ${maxFiles} files allowed, so ${skipped} ${skipped === 1 ? "was" : "were"} skipped.` : null);

    const added: MediaItem[] = [];
    for (const file of chosen) {
      const key = nextKey();
      const check = classifyFile(file, accept);
      if (!check.ok) {
        added.push({ key, kind: check.kind, status: "error", progress: 0, previewUrl: null, error: check.error, canRetry: false });
        continue;
      }
      const task: UploadTask = { file, kind: check.kind, contentType: check.contentType };
      if (check.kind === "video") task.objectUrl = URL.createObjectURL(file);
      tasksRef.current.set(key, task);
      added.push({ key, kind: check.kind, status: "processing", progress: 0, previewUrl: task.objectUrl ?? null });
    }
    setItems((current) => [...current, ...added]);
    for (const item of added) if (tasksRef.current.has(item.key)) void runTask(item.key);
  }

  function removeItem(key: string) {
    const task = tasksRef.current.get(key);
    if (task) {
      discardTask(task);
      tasksRef.current.delete(key);
    }
    setItems((current) => current.filter((item) => item.key !== key));
    setNotice(null);
  }

  function retryItem(key: string) {
    if (!tasksRef.current.has(key)) return;
    patchItem(key, { status: "processing", progress: 0, error: undefined });
    void runTask(key);
  }

  const uploading = items.some((item) => item.status === "processing" || item.status === "uploading");
  const failed = items.filter((item) => item.status === "error").length;
  const canAdd = items.length < maxFiles;
  const noun = accept === "image" ? "photo" : "photo or video";
  const AddIcon = capture ? Camera : ImagePlus;

  return (
    <div role="group" aria-labelledby={label ? labelId : undefined} aria-label={label ? undefined : "Photos"} className="relative space-y-2">
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <span id={labelId} className="text-sm font-medium text-foreground">
            {label}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {items.length}/{maxFiles}
          </span>
        </div>
      ) : null}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.key}>
            <MediaTile
              item={item}
              index={index}
              onRemove={() => removeItem(item.key)}
              onRetry={() => retryItem(item.key)}
            />
          </li>
        ))}
        {canAdd ? (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-input",
                "bg-card px-2 text-center text-xs font-medium text-muted-foreground transition-colors",
                "hover:border-primary hover:text-primary active:bg-accent",
              )}
            >
              <AddIcon className="size-6" aria-hidden="true" />
              <span>Add {noun}</span>
              {!label ? <span className="tabular-nums font-normal">{items.length}/{maxFiles}</span> : null}
            </button>
          </li>
        ) : null}
      </ul>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={accept === "image" ? "image/*" : "image/*,video/*"}
        capture={capture ? "environment" : undefined}
        multiple={maxFiles - items.length > 1}
        onChange={handleFiles}
      />

      {items.map((item) =>
        item.status === "done" && item.fileId ? (
          <input key={`value-${item.key}`} type="hidden" name={name} value={item.fileId} />
        ) : null,
      )}

      {uploading ? (
        <>
          <input type="hidden" name={`${name}__uploading`} value="1" />
          {/* Invisible required control: native form submit is blocked with this message until uploads finish. */}
          <input
            type="checkbox"
            required
            tabIndex={-1}
            aria-hidden="true"
            ref={holdSubmitWhileUploading}
            className="pointer-events-none absolute bottom-0 left-4 size-px opacity-0"
          />
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            Uploading… keep this screen open until it finishes.
          </p>
        </>
      ) : null}

      {!uploading && failed > 0 ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {failed === 1 ? "1 file didn't upload." : `${failed} files didn't upload.`} Tap Retry or remove it before saving.
        </p>
      ) : null}

      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
    </div>
  );
}

function holdSubmitWhileUploading(element: HTMLInputElement | null) {
  element?.setCustomValidity("Please wait, photos are still uploading.");
}

/* ------------------------------------------------------------------ */
/* Tile                                                                */
/* ------------------------------------------------------------------ */

function MediaTile({
  item,
  index,
  onRemove,
  onRetry,
}: {
  item: MediaItem;
  index: number;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const noun = item.kind === "video" ? "video" : "photo";
  const showPreview = item.previewUrl !== null && !broken;
  const PlaceholderIcon = broken ? ImageOff : item.kind === "video" ? Video : ImagePlus;

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      {showPreview && item.kind === "video" ? (
        <>
          {/* #t=0.1 makes iOS paint the first frame as a poster. */}
          <video
            src={`${item.previewUrl}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            aria-label={`Video ${index + 1}`}
            className="pointer-events-none size-full object-cover"
            onError={() => setBroken(true)}
          />
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-9 place-items-center rounded-full bg-black/55 text-white">
              <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
            </span>
          </span>
        </>
      ) : null}

      {showPreview && item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: previews and session-protected /api/v1/files URLs can't use next/image
        <img
          src={item.previewUrl ?? undefined}
          alt={`Photo ${index + 1}`}
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}

      {!showPreview ? (
        <div className="grid size-full place-items-center text-muted-foreground">
          <PlaceholderIcon className="size-6" aria-hidden="true" />
        </div>
      ) : null}

      {item.status === "processing" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-[11px] font-medium text-white">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          {item.kind === "image" ? "Preparing…" : "Waiting…"}
        </div>
      ) : null}

      {item.status === "uploading" ? (
        <div className="absolute inset-x-0 bottom-0 space-y-1 bg-black/55 px-2 pb-2 pt-1.5 text-[11px] font-medium text-white">
          <span className="tabular-nums">Uploading {item.progress}%</span>
          <Progress
            value={item.progress}
            className="h-1.5 bg-white/30"
            indicatorClassName="bg-white"
            aria-label={`Uploading ${noun} ${index + 1}`}
          />
        </div>
      ) : null}

      {item.status === "error" ? (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-danger/90 p-2 text-center text-[11px] leading-snug text-white"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <span className="line-clamp-3">{item.error}</span>
          {item.canRetry !== false ? (
            <Button type="button" size="sm" variant="secondary" onClick={onRetry} className="h-7 bg-white px-2 text-xs text-foreground hover:bg-white/90 pointer-coarse:h-8">
              <RotateCw className="size-3.5" aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${noun} ${index + 1}`}
        className="absolute right-1 top-1 z-10 grid size-8 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* File checks and image compression                                   */
/* ------------------------------------------------------------------ */

type FileCheck = { ok: true; kind: MediaKind; contentType: string } | { ok: false; kind: MediaKind; error: string };

function classifyFile(file: File, accept: "image" | "image+video"): FileCheck {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = (file.type || EXTENSION_TYPES[extension] || "").toLowerCase();
  if (file.size === 0) return { ok: false, kind: "image", error: "This file is empty." };

  if (type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, kind: "image", error: `Photo is over ${formatMb(MAX_IMAGE_BYTES)}.` };
    }
    return { ok: true, kind: "image", contentType: type === "image/jpg" ? "image/jpeg" : type };
  }
  if (type.startsWith("video/")) {
    if (accept !== "image+video") return { ok: false, kind: "video", error: "Only photos can be added here." };
    if (!VIDEO_TYPES.includes(type)) return { ok: false, kind: "video", error: "Use an MP4, MOV or WebM video." };
    if (file.size > MAX_VIDEO_BYTES) {
      return { ok: false, kind: "video", error: `Video is over ${formatMb(MAX_VIDEO_BYTES)}. Record a shorter clip.` };
    }
    return { ok: true, kind: "video", contentType: type };
  }
  return { ok: false, kind: "image", error: accept === "image" ? "That file isn't a photo." : "That file isn't a photo or video." };
}

async function prepareFile(task: UploadTask): Promise<PreparedFile> {
  const { file, kind, contentType } = task;
  if (kind === "video") {
    return { blob: withType(file, contentType), filename: file.name || "video.mp4", contentType };
  }
  const compressed = await compressImage(file);
  const originalAllowed = IMAGE_TYPES.includes(contentType);
  // Keep a small, already-compatible original (e.g. a 150 KB JPEG) if re-encoding would only grow it.
  if (compressed && (!originalAllowed || compressed.size < file.size)) {
    return { blob: compressed, filename: jpegName(file.name), contentType: "image/jpeg" };
  }
  if (originalAllowed) return { blob: withType(file, contentType), filename: file.name || "photo.jpg", contentType };
  throw new UploadError("This photo format can't be read here. Use a JPEG, PNG or WebP photo.", { permanent: true });
}

/** Resize to MAX_EDGE_PX on the long edge and re-encode as JPEG. Returns null if the browser can't decode it. */
async function compressImage(file: Blob): Promise<Blob | null> {
  const source = await decodeImage(file);
  if (!source) return null;
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff"; // JPEG has no alpha: flatten transparent PNGs on white, not black
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source.image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    canvas.width = 0; // release the bitmap promptly (iOS has a tight canvas memory budget)
    canvas.height = 0;
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  } finally {
    source.release();
  }
}

/**
 * Decode with EXIF orientation applied. createImageBitmap(…, { imageOrientation: "from-image" })
 * is fastest; older Safari falls back to an <img>, which browsers also auto-rotate.
 */
async function decodeImage(
  file: Blob,
): Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bitmap.width > 0 && bitmap.height > 0) {
        return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      }
      bitmap.close();
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("empty image");
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function withType(blob: Blob, type: string): Blob {
  return blob.type === type ? blob : blob.slice(0, blob.size, type);
}

function jpegName(name: string): string {
  const stem = (name || "photo").replace(/\.[^.]*$/, "") || "photo";
  return `${stem}.jpg`;
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

class UploadError extends Error {
  /** Worth retrying automatically (network blip, timeout, 5xx, 429). */
  readonly transient: boolean;
  /** Retrying won't help (validation, file too large, no permission). */
  readonly permanent: boolean;
  readonly status: number;

  constructor(message: string, options: { transient?: boolean; permanent?: boolean; status?: number } = {}) {
    super(message);
    this.name = "UploadError";
    this.transient = options.transient ?? false;
    this.permanent = options.permanent ?? false;
    this.status = options.status ?? 0;
  }
}

function toUploadError(error: unknown): UploadError {
  return error instanceof UploadError ? error : new UploadError("Upload failed. Tap Retry.");
}

function cancelled(): UploadError {
  return new UploadError("Upload cancelled.");
}

function uploadDirect(
  prepared: PreparedFile,
  kind: MediaKind,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<UploadedFile> {
  return withRetries(signal, () => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", prepared.blob, prepared.filename);
    return send<UploadedFile>({
      method: "POST",
      url: "/api/v1/files",
      body: form,
      signal,
      onProgress: (loaded, total) => onProgress(total > 0 ? loaded / total : 0),
    });
  });
}

async function uploadChunked(
  task: UploadTask,
  signal: AbortSignal,
  onProgress: (fraction: number) => void,
): Promise<UploadedFile> {
  const prepared = task.prepared;
  if (!prepared) throw new UploadError("Nothing to upload.");
  const { blob, filename, contentType } = prepared;

  try {
    if (!task.session) {
      const created = await withRetries(signal, () =>
        send<{ uploadId: string; pieceBytes: number; pieces: number }>({
          method: "POST",
          url: "/api/v1/files/uploads",
          json: { filename, contentType, size: blob.size, kind: task.kind },
          signal,
        }),
      );
      if (!created?.uploadId || !(created.pieceBytes > 0) || created.pieces !== Math.ceil(blob.size / created.pieceBytes)) {
        throw new UploadError("The server returned an unexpected upload session. Tap Retry.", { transient: true });
      }
      task.session = { ...created, next: 0 };
    }

    const session = task.session;
    const url = `/api/v1/files/uploads/${encodeURIComponent(session.uploadId)}`;
    for (let index = session.next; index < session.pieces; index += 1) {
      const start = index * session.pieceBytes;
      const piece = blob.slice(start, Math.min(start + session.pieceBytes, blob.size));
      onProgress(start / blob.size);
      await withRetries(signal, () =>
        send({
          method: "PUT",
          url,
          body: piece,
          headers: { "Content-Type": "application/octet-stream", "x-piece-index": String(index) },
          signal,
          onProgress: (loaded) => onProgress((start + loaded) / blob.size),
        }),
      );
      session.next = index + 1; // a manual Retry resumes from here
    }

    const uploaded = await withRetries(signal, () => send<UploadedFile>({ method: "POST", url, signal }));
    task.session = undefined;
    return uploaded;
  } catch (error) {
    // An expired session or a rejected piece can't be resumed, so the next Retry starts fresh.
    if (!signal.aborted && !(error instanceof UploadError && error.transient)) task.session = undefined;
    throw error;
  }
}

async function withRetries<T>(signal: AbortSignal, attempt: () => Promise<T>): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (signal.aborted || !(error instanceof UploadError) || !error.transient || tries >= AUTO_ATTEMPTS) throw error;
      await wait(1000 * 2 ** (tries - 1), signal); // 1 s, 2 s
    }
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

interface SendOptions {
  method: "POST" | "PUT";
  url: string;
  body?: XMLHttpRequestBodyInit;
  json?: unknown;
  headers?: Record<string, string>;
  signal: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

/** XMLHttpRequest as a promise: fetch can't report upload progress. */
function send<T = unknown>({ method, url, body, json, headers, signal, onProgress }: SendOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    xhr.setRequestHeader("Accept", "application/json");
    if (json !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
    for (const [header, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(header, value);
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      });
    }

    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const settle = (finish: () => void) => {
      signal.removeEventListener("abort", onAbort);
      finish();
    };

    xhr.addEventListener("load", () =>
      settle(() => {
        const payload = parseJson(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload as T);
        else reject(httpError(xhr.status, payload));
      }),
    );
    xhr.addEventListener("error", () =>
      settle(() =>
        reject(
          new UploadError(
            typeof navigator !== "undefined" && !navigator.onLine
              ? "You're offline. Reconnect, then tap Retry."
              : "Network error. Check your connection and tap Retry.",
            { transient: true },
          ),
        ),
      ),
    );
    xhr.addEventListener("timeout", () =>
      settle(() => reject(new UploadError("The connection is too slow and the upload timed out. Tap Retry.", { transient: true }))),
    );
    xhr.addEventListener("abort", () => settle(() => reject(cancelled())));

    xhr.send(json !== undefined ? JSON.stringify(json) : (body ?? null));
  });
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function httpError(status: number, payload: unknown): UploadError {
  const serverMessage = (payload as { error?: { message?: unknown } } | null)?.error?.message;
  const transient = status === 408 || status === 429 || status >= 500;
  const permanent = status === 400 || status === 403 || status === 413 || status === 415 || status === 422;
  const options = { transient, permanent, status };

  if (status === 401) return new UploadError("Your session has expired. Sign in again, then tap Retry.", options);
  if (status === 413) return new UploadError("This file is too large to upload.", options);
  if (typeof serverMessage === "string" && serverMessage && status < 500) return new UploadError(serverMessage, options);
  if (transient) return new UploadError("The server couldn't save the file just now. Tap Retry.", options);
  return new UploadError(`Upload failed (error ${status}). Tap Retry.`, options);
}

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

/** Cancel the request, free the preview, and drop any half-finished chunked upload on the server. */
function discardTask(task: UploadTask) {
  task.controller?.abort();
  if (task.objectUrl) URL.revokeObjectURL(task.objectUrl);
  if (task.session) {
    void fetch(`/api/v1/files/uploads/${encodeURIComponent(task.session.uploadId)}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => undefined);
    task.session = undefined;
  }
}

/** Tiny semaphore so only PARALLEL_UPLOADS files upload at once. */
function createLimiter(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return {
    acquire(): Promise<void> {
      if (active < limit) {
        active += 1;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => waiting.push(resolve));
    },
    release(): void {
      const next = waiting.shift();
      if (next) next(); // hand the slot straight to the next waiting upload
      else active = Math.max(0, active - 1);
    },
  };
}
