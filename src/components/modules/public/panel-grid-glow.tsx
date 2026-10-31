"use client";

/**
 * Solar-panel lines under the cursor in the landing hero. Invisible until the
 * mouse is over the section; then a soft-edged square around the pointer
 * reveals a panel's cell grid (cells with faint busbars) in current lime.
 *
 * The pointer position is written straight to CSS variables (no React
 * re-render per mouse move); the grid and the square mask live in
 * src/app/globals.css ("Hero panel grid"). Mouse only — touch screens never
 * see it — and it sits behind the hero content with pointer-events off.
 */
import { useEffect, useRef } from "react";

export function PanelGridGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    const host = layer?.parentElement;
    if (!layer || !host) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = host.getBoundingClientRect();
        layer.style.setProperty("--gx", `${e.clientX - box.left}px`);
        layer.style.setProperty("--gy", `${e.clientY - box.top}px`);
        layer.dataset.on = "true";
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      delete layer.dataset.on;
    };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="panel-grid-glow" />;
}
