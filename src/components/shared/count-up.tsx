"use client";

/**
 * A number that counts up from 0 to its value the first time it scrolls into
 * view (about 1.4 s, easing out). Screen readers always get the real value
 * (visually hidden text); reduced motion shows it straight away. The visible
 * digits start at 0 so the count never flashes the final value first.
 */
import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1400;

export function CountUp({
  to,
  prefix = "",
  suffix = "",
  format = (n) => n.toLocaleString("en-IN"),
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    // Reduced motion (or no IntersectionObserver): show the value on the next frame, no counting.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      frame = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(to * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">
        {prefix}
        {format(value)}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {format(to)}
        {suffix}
      </span>
    </span>
  );
}
