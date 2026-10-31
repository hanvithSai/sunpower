"use client";

/**
 * <BarcodeScanner>: scan serial-number barcodes (Code 128/39, EAN, QR, Data
 * Matrix…) with the phone's rear camera at dispatch and at the warehouse.
 *
 *   <BarcodeScanner onDetected={(serial) => addSerial(serial)} paused={isSaving} />
 *
 * Why it works this way
 * - Uses @zxing/browser (open source, works offline, no paid SDK). The library
 *   is imported only when the camera starts, so pages that never scan don't
 *   download it.
 * - The camera runs inside an effect keyed on "active". Cleanup ALWAYS calls
 *   `controls.stop()`, which stops the camera tracks (and the recording light)
 *   on Stop, on unmount and when the tab is hidden. If the user stops or leaves
 *   while the permission prompt is still open, the late-arriving stream is
 *   stopped right away. Each session gets its own <video> element, so a slow,
 *   cancelled start can never tear down a newer one.
 * - The same code seen again within 2.5 s is ignored (the window restarts on
 *   every sighting), so holding the phone over one panel doesn't add it ten
 *   times. A 60 ms vibration confirms each accepted scan.
 * - `paused` keeps the camera running but ignores results, e.g. while the
 *   parent validates a serial, which avoids a camera restart for each scan.
 * - Browsers only expose the camera on secure origins (HTTPS or localhost), and
 *   permission or hardware problems become plain-language messages. The
 *   dispatch screen always keeps manual serial entry as the fallback.
 */

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, LoaderCircle, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Ignore the same code if it is seen again within this window. */
const REPEAT_WINDOW_MS = 2500;

type ScannerStatus = "idle" | "starting" | "scanning" | "error";

export interface BarcodeScannerProps {
  onDetected: (text: string) => void;
  /** Keep the camera on but ignore detections (e.g. while the parent saves). */
  paused?: boolean;
}

export function BarcodeScanner({ onDetected, paused = false }: BarcodeScannerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastAcceptedRef = useRef<{ text: string; at: number } | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  // Effect Event: always sees the latest `paused` / `onDetected` without restarting the camera.
  const handleDecoded = useEffectEvent((text: string) => {
    const now = Date.now();
    const last = lastAcceptedRef.current;
    if (last && last.text === text && now - last.at < REPEAT_WINDOW_MS) {
      last.at = now; // still in view: keep suppressing until it has been gone for 2.5 s
      return;
    }
    if (paused) return;
    lastAcceptedRef.current = { text, at: now };
    try {
      navigator.vibrate?.(60);
    } catch {
      // vibration is best-effort (unsupported on iOS)
    }
    setLastCode(text);
    try {
      onDetected(text);
    } catch (error) {
      // An exception here must not kill the zxing scan loop.
      console.error("[barcode-scanner] onDetected failed", error);
    }
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!active || !viewport) return;

    let cancelled = false;
    let controls: IScannerControls | null = null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true; // iOS: render inline instead of going full screen
    video.autoplay = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.className = "absolute inset-0 size-full object-cover";
    viewport.appendChild(video);

    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 150,
          delayBetweenScanSuccess: 300,
        });
        const started = await reader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          video,
          (result) => {
            if (cancelled || !result) return;
            const text = result.getText().trim();
            if (text) handleDecoded(text);
          },
        );
        if (cancelled) {
          started.stop(); // stopped or unmounted while the permission prompt was open
          return;
        }
        controls = started;
        setStatus("scanning");
      } catch (error) {
        if (cancelled) return;
        setMessage(describeCameraError(error));
        setStatus("error");
        setActive(false);
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
      controls = null;
      video.remove();
    };
  }, [active]);

  // Phones suspend the camera in background tabs; stop cleanly and let the user restart.
  useEffect(() => {
    if (!active) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setActive(false);
        setStatus("idle");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [active]);

  function toggleCamera() {
    if (active) {
      setActive(false);
      setStatus("idle");
      return;
    }
    const problem = cameraSupportProblem();
    if (problem) {
      setMessage(problem);
      setStatus("error");
      return;
    }
    setMessage(null);
    setStatus("starting");
    setActive(true);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-950 text-white">
        {/* zxing renders the camera preview into a <video> created per session inside this box. */}
        <div ref={viewportRef} className="absolute inset-0" />

        {status === "scanning" ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
            <div className="relative h-[42%] w-[80%] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              <span className="absolute left-0 top-0 size-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-white" />
              <span className="absolute right-0 top-0 size-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-white" />
              <span className="absolute bottom-0 left-0 size-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-white" />
              <span className="absolute bottom-0 right-0 size-6 rounded-br-lg border-b-[3px] border-r-[3px] border-white" />
              {!paused ? (
                <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-danger/90" />
              ) : null}
            </div>
          </div>
        ) : null}

        {status === "scanning" && paused ? (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-black/65 px-3 py-1 text-xs font-medium">Paused</span>
          </div>
        ) : null}

        {status !== "scanning" ? (
          <div
            role={status === "error" ? "alert" : undefined}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
          >
            {status === "starting" ? (
              <>
                <LoaderCircle className="size-8 animate-spin text-white/80" aria-hidden="true" />
                <p className="text-sm text-white/80">Starting camera…</p>
              </>
            ) : status === "error" ? (
              <>
                <CameraOff className="size-8 text-white/70" aria-hidden="true" />
                <p className="max-w-xs text-sm leading-relaxed text-white/90">{message}</p>
              </>
            ) : (
              <>
                <ScanLine className="size-8 text-white/60" aria-hidden="true" />
                <p className="text-sm text-white/70">Camera is off</p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {lastCode ? (
            <>
              Last scan: <span className="font-mono font-medium text-foreground">{lastCode}</span>
            </>
          ) : status === "scanning" ? (
            "Hold the barcode inside the frame."
          ) : (
            "Scan serial numbers with the rear camera."
          )}
        </p>
        <Button
          type="button"
          variant={active ? "outline" : "default"}
          onClick={toggleCamera}
          aria-pressed={active}
          className={cn(!active && "min-w-36")}
        >
          {active ? <CameraOff aria-hidden="true" /> : <Camera aria-hidden="true" />}
          {active ? "Stop camera" : "Start camera"}
        </Button>
      </div>
    </div>
  );
}

/** Problems we can detect before asking for the camera. */
function cameraSupportProblem(): string | null {
  if (!window.isSecureContext) {
    return "The camera only works on a secure connection (HTTPS or localhost). Open the app through its https:// address to scan, or type the serial number.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser can't use the camera. Try Chrome or Safari, or type the serial number.";
  }
  return null;
}

function describeCameraError(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access for this site in your browser settings, then tap Start camera again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Type the serial number instead.";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "The camera is being used by another app or tab. Close it, then tap Start camera again.";
    default:
      return "Couldn't start the camera. Tap Start camera to try again, or type the serial number.";
  }
}
