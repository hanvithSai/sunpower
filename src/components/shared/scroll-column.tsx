"use client";

/**
 * A board column that shows the first five cards and scrolls the rest inside
 * itself, so a long stage never stretches the page. It measures where the 6th
 * card starts (cards have different heights) and caps the height there; below
 * it says how many more there are. Keyboard users can focus it and scroll with
 * the arrow keys.
 */
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ScrollColumn({
  children,
  label,
  visible = 5,
  className,
}: {
  children: ReactNode;
  /** Names the scroll area for screen readers, e.g. "Not applied cards". */
  label: string;
  visible?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const count = Children.count(children);
  const overflow = count > visible;

  useEffect(() => {
    const el = ref.current;
    if (!el || !overflow) return;
    // ResizeObserver fires once on observe and again when cards reflow.
    const observer = new ResizeObserver(() => {
      const cut = el.children[visible] as HTMLElement | undefined;
      setMaxHeight(cut ? cut.offsetTop - 4 : null);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [overflow, visible, count]);

  return (
    <>
      <div
        ref={ref}
        role={overflow ? "region" : undefined}
        aria-label={overflow ? label : undefined}
        tabIndex={overflow ? 0 : undefined}
        className={cn(
          "relative space-y-2",
          overflow && "overflow-y-auto overscroll-contain [scrollbar-width:thin]",
          // Before the first measurement, a safe cap so the page never jumps very tall.
          overflow && maxHeight === null && "max-h-[36rem]",
          className,
        )}
        style={overflow && maxHeight !== null ? { maxHeight } : undefined}
      >
        {children}
      </div>
      {overflow ? (
        <p className="px-2 pt-2 text-center text-xs text-muted-foreground">
          Showing {visible} of {count}. Scroll for {count - visible} more.
        </p>
      ) : null}
    </>
  );
}
