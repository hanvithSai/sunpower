"use client";

/**
 * <SignaturePad>: the homeowner signs on the technician's phone or tablet to
 * accept the installation. The PNG data URL goes into a hidden input, so a plain
 * Server Action form receives it as `formData.get(name)` (stored on the job as
 * `signature.dataUrl`).
 *
 * Why it works this way
 * - `signature_pad` draws smooth, pressure-like Bézier strokes from
 *   pointer/touch events. `touch-action: none` stops the page from scrolling or
 *   zooming while the customer signs.
 * - The canvas backing store is sized to CSS size × devicePixelRatio (capped at
 *   3) and the context scaled to match, so strokes are crisp on retina screens.
 *   A ResizeObserver redoes this on rotation or layout changes and redraws the
 *   strokes, because resizing a canvas wipes it.
 * - The background is filled white (not transparent), so the PNG looks right
 *   on the printed certificate and in dark image viewers. A finger signature
 *   is roughly 20-60 KB, well inside the 1 MB Server Action body limit.
 * - The value is written on every stroke end (empty after Clear). With
 *   `required`, an invisible unnamed checkbox carries the custom validity
 *   message "Please sign" while the pad is empty, so the browser blocks submit
 *   and shows it next to the pad. Validity is updated in the stroke and Clear
 *   handlers themselves, not after a re-render, so a fast submit is never
 *   judged on stale state. A checkbox (unlike a text input) doesn't pop up the
 *   phone keyboard when the browser focuses it.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Check, Eraser } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SignaturePadProps {
  /** Form field name that receives the PNG data URL ("" when unsigned). */
  name: string;
  required?: boolean;
  label?: string;
}

export function SignaturePad({ name, required = false, label = "Customer signature" }: SignaturePadProps) {
  const labelId = useId();
  const hintId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const validityRef = useRef<HTMLInputElement>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(29, 29, 31)",
      minWidth: 0.7,
      maxWidth: 2.6,
    });
    padRef.current = pad;

    const handleStrokeEnd = () => {
      const value = pad.isEmpty() ? "" : pad.toDataURL("image/png");
      // Mark valid right away (not after React re-renders) so an instant submit isn't wrongly blocked.
      if (value) validityRef.current?.setCustomValidity("");
      setDataUrl(value);
      if (value) setShowError(false);
    };

    // Size the backing store to CSS px × DPR; keep (and redraw) existing strokes.
    let cssWidth = 0;
    let cssHeight = 0;
    let ratio = 0;
    const fitCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const nextRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
      if (rect.width === 0 || rect.height === 0) return; // hidden (e.g. collapsed section)
      if (rect.width === cssWidth && rect.height === cssHeight && nextRatio === ratio) return;
      cssWidth = rect.width;
      cssHeight = rect.height;
      ratio = nextRatio;

      const strokes = pad.toData();
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear(); // repaints the white background at the new size
      if (strokes.length > 0) pad.fromData(strokes);
      // The data URL saved at the last stroke end is still a faithful image, so it is kept as is.
    };

    fitCanvas();
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(canvas);
    window.addEventListener("resize", fitCanvas); // DPR changes (browser zoom) don't always resize the element
    pad.addEventListener("endStroke", handleStrokeEnd);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitCanvas);
      pad.removeEventListener("endStroke", handleStrokeEnd);
      pad.off();
      padRef.current = null;
    };
  }, []);

  // Native constraint validation: a non-empty custom validity message blocks submit until signed.
  useLayoutEffect(() => {
    validityRef.current?.setCustomValidity(required && !dataUrl ? "Please sign" : "");
  }, [required, dataUrl]);

  function clear() {
    padRef.current?.clear();
    if (required) validityRef.current?.setCustomValidity("Please sign");
    setDataUrl("");
  }

  const signed = dataUrl !== "";
  const invalid = showError && !signed;

  return (
    <div className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span id={labelId} className="text-sm font-medium text-foreground">
          {label}
          {required ? (
            <span className="text-danger-foreground" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </span>
        {signed ? (
          <Badge variant="success">
            Signed
            <Check aria-hidden="true" />
          </Badge>
        ) : null}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-lg border bg-white shadow-xs",
          invalid ? "border-danger ring-2 ring-danger/25" : "border-input",
        )}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby={labelId}
          aria-describedby={hintId}
          className="block h-44 w-full cursor-crosshair touch-none select-none sm:h-52"
          style={{ touchAction: "none" }}
        />
        {!signed ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 bottom-10 flex items-end gap-2 border-b border-dashed border-input pb-1 text-sm text-muted-foreground"
          >
            <span className="text-base leading-none">✕</span>
            Sign here
          </div>
        ) : null}
        {/* Invisible validity carrier for `required` (unnamed, so it never reaches the form data). */}
        <input
          ref={validityRef}
          type="checkbox"
          tabIndex={-1}
          aria-hidden="true"
          onInvalid={() => setShowError(true)}
          className="pointer-events-none absolute bottom-3 left-1/2 size-px opacity-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p id={hintId} className={cn("text-xs", invalid ? "text-danger-foreground" : "text-muted-foreground")}>
          {invalid ? "Please sign before submitting." : "Sign with a finger or stylus inside the box."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!signed}>
          <Eraser aria-hidden="true" />
          Clear
        </Button>
      </div>

      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}
