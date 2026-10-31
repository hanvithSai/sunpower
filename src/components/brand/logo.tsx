/**
 * SunPower OS logo: an amber rounded-square tile with a white sun, plus the
 * "SunPower OS" wordmark. Server-safe (no hooks), so it renders anywhere.
 *
 * The wordmark inherits `currentColor` (ink by default), so it can be placed on
 * a dark surface with `className="text-white"`. The same artwork ships as
 * src/app/icon.svg (favicon) and public/logo.svg (documents, README).
 */
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { root: string; tile: string; glyph: string; wordmark: string }> = {
  sm: { root: "gap-2", tile: "size-7 rounded-[8px]", glyph: "size-5", wordmark: "text-[15px]" },
  md: { root: "gap-2.5", tile: "size-8 rounded-[9px]", glyph: "size-5.5", wordmark: "text-[17px]" },
  lg: { root: "gap-3", tile: "size-11 rounded-[12px]", glyph: "size-7.5", wordmark: "text-[22px]" },
};

export type LogoProps = {
  className?: string;
  /** Show the "SunPower OS" text next to the tile. Defaults to true. */
  showWordmark?: boolean;
  size?: LogoSize;
};

export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex shrink-0 items-center text-foreground", s.root, className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center bg-linear-to-b from-[#FFB340] to-[#FF9F0A] text-white",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(255_159_10/0.35)]",
          s.tile,
        )}
      >
        <SunGlyph className={s.glyph} />
      </span>
      {showWordmark ? (
        <span className={cn("font-semibold leading-none tracking-tight whitespace-nowrap", s.wordmark)}>
          SunPower <span className="font-medium opacity-70">OS</span>
        </span>
      ) : (
        <span className="sr-only">SunPower OS</span>
      )}
    </span>
  );
}

/** The sun mark used inside the tile (24-unit grid, same proportions as icon.svg). */
function SunGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.25" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
        <path d="M12 5.1V2.6" />
        <path d="M12 18.9v2.5" />
        <path d="M5.1 12H2.6" />
        <path d="M18.9 12h2.5" />
        <path d="m7.12 7.12-1.77-1.77" />
        <path d="m16.88 7.12 1.77-1.77" />
        <path d="m7.12 16.88-1.77 1.77" />
        <path d="m16.88 16.88 1.77 1.77" />
      </g>
    </svg>
  );
}
