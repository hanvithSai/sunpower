/**
 * <MediaGallery>: read-only grid of the photos and videos on a survey, job or
 * ticket (async Server Component).
 *
 *   <MediaGallery ids={survey.photos} emptyText="No roof photos yet" />
 *
 * Why it works this way
 * - It reads only the small GridFS files docs (type, size, upload time) on the
 *   server. Ids that were deleted or are still uploading are skipped, so the
 *   page never shows broken tiles. The bytes stream separately from the
 *   session-checked /api/v1/files/{id} route, which supports byte ranges.
 * - Plain <img> instead of next/image: the image optimizer fetches the source
 *   without the user's session cookie, so it can't read protected files.
 *   Photos are already ~1600 px JPEGs from the uploader, and loading="lazy"
 *   keeps long galleries light on mobile data.
 * - Videos use preload="metadata" so only the first bytes load until the user
 *   presses play, and playsInline so iOS doesn't jump to full screen.
 * - Each tile is captioned with its upload time in IST: when the photo reached
 *   the server, which is the proof-of-work timestamp.
 * - Like any uncached data read under Cache Components, render it below the
 *   page's session check (requireUser) or inside a <Suspense> boundary.
 */
import "server-only";

import { formatDateTime } from "@/lib/format";
import { getFilesInfo } from "@/server/services/core/files";

export interface MediaGalleryProps {
  ids: string[];
  emptyText?: string;
}

export async function MediaGallery({ ids, emptyText = "No photos yet" }: MediaGalleryProps) {
  const files = await getFilesInfo(ids ?? []);

  if (files.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file, index) => {
        const src = `/api/v1/files/${file.id}`;
        const noun = file.kind === "video" ? "Video" : "Photo";
        return (
          <li key={file.id}>
            <figure className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
              {file.kind === "video" ? (
                <video
                  src={src}
                  controls
                  preload="metadata"
                  playsInline
                  aria-label={`${noun} ${index + 1}`}
                  className="aspect-square w-full bg-black object-contain"
                />
              ) : (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${noun.toLowerCase()} ${index + 1} full size`}
                  className="block bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- session-protected GridFS URL; next/image can't forward the cookie */}
                  <img
                    src={src}
                    alt={`${noun} ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover transition-opacity hover:opacity-90"
                  />
                </a>
              )}
              <figcaption className="px-2.5 py-1.5 text-xs text-muted-foreground">
                <time dateTime={file.uploadedAt.toISOString()}>{formatDateTime(file.uploadedAt)}</time>
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
