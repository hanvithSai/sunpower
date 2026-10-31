/**
 * SunPower logo: a sunlight-amber sun rising behind a solar panel on a deep
 * forest tile, plus the "SunPower" wordmark in the display face. Server-safe
 * (no hooks), so it renders anywhere.
 *
 * The wordmark inherits `currentColor` (forest ink by default), so it can sit
 * on the dark forest surfaces with `className="text-white"`. The same artwork
 * ships as src/app/icon.svg (favicon) and public/logo.svg (documents, README).
 */
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { root: string; tile: string; wordmark: string }> = {
  sm: { root: "gap-2", tile: "size-7 rounded-[7px]", wordmark: "text-[17px]" },
  md: { root: "gap-2.5", tile: "size-8 rounded-[8px]", wordmark: "text-[19px]" },
  lg: { root: "gap-3", tile: "size-11 rounded-[11px]", wordmark: "text-[25px]" },
};

export type LogoProps = {
  className?: string;
  /** Show the "SunPower" text next to the tile. Defaults to true. */
  showWordmark?: boolean;
  size?: LogoSize;
};

export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex shrink-0 items-center text-forest", s.root, className)}>
      <LogoMark className={s.tile} />
      {showWordmark ? (
        <span className={cn("font-display leading-none font-semibold tracking-[-0.02em] whitespace-nowrap", s.wordmark)}>SunPower</span>
      ) : (
        <span className="sr-only">SunPower</span>
      )}
    </span>
  );
}

/** The mark alone (64-unit grid, same drawing as icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("shrink-0", className)} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="62" height="62" rx="13" fill="#0F2F24" stroke="#DCE9DF" strokeOpacity="0.28" strokeWidth="2" />
      <circle cx="39" cy="24" r="11" fill="#F2B441" />
      <path d="M22 31h33l-10 17H12z" fill="#DCE9DF" />
      <g stroke="#0F2F24" strokeWidth="2.2" strokeLinecap="round">
        <path d="M33 31l-10 17" />
        <path d="M44 31l-10 17" />
        <path d="M17 39.5h33" />
      </g>
    </svg>
  );
}
