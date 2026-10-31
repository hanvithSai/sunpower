/**
 * Avatar — initials on a softly tinted circle.
 * The tint is picked deterministically from the name, so the same person always gets
 * the same colour across lists, timelines and menus (no photos needed).
 */
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

type AvatarSize = "sm" | "md" | "lg";

/** Earth tones from the SunPower palette: a soft tint with a dark text variant (all ≥ 5.9:1). */
const PALETTE = [
  "bg-[#1d5c40]/12 text-[#1a5238]", // forest
  "bg-[#f2b441]/20 text-[#7a4a00]", // sunlight
  "bg-[#2f7ed8]/12 text-[#1b5a9e]", // sky
  "bg-[#b5653a]/14 text-[#8a3f17]", // clay
  "bg-[#5b8a3a]/14 text-[#3d6324]", // moss
  "bg-[#2b8a8a]/14 text-[#16615f]", // teal
  "bg-[#7a5ea8]/12 text-[#58407f]", // plum
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
