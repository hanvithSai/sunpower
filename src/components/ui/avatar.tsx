/**
 * Avatar — initials on a softly tinted circle.
 * The tint is picked deterministically from the name, so the same person always gets
 * the same colour across lists, timelines and menus (no photos needed).
 */
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

type AvatarSize = "sm" | "md" | "lg";

/** Apple system colours: 12–14% tint with the accessible dark text variant. */
const PALETTE = [
  "bg-[#007aff]/12 text-[#0040dd]", // blue
  "bg-[#34c759]/14 text-[#248a3d]", // green
  "bg-[#5856d6]/12 text-[#3634a3]", // indigo
  "bg-[#ff9500]/14 text-[#c93400]", // orange
  "bg-[#ff2d55]/12 text-[#d30f45]", // pink
  "bg-[#af52de]/12 text-[#8944ab]", // purple
  "bg-[#30b0c7]/14 text-[#0071a4]", // teal
] as const;

const SIZES: Record<AvatarSize, string> = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-[13px]",
  lg: "size-12 text-base",
};

function hashName(name: string): number {
  let hash = 5381;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return Math.abs(hash);
}

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  className?: string;
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const label = name.trim() || "Unknown";
  const tone = PALETTE[hashName(label) % PALETTE.length];

  return (
    <span
      data-slot="avatar"
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight select-none",
        tone,
        SIZES[size],
        className,
      )}
    >
      {/* Generated content, so a button labelled "Account menu for …" needn't repeat the initials (WCAG 2.5.3). */}
      <span aria-hidden="true" data-initials={initials(label) || "?"} className="before:content-[attr(data-initials)]" />
    </span>
  );
}
