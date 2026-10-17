"use client";

import { useEffect, useRef, useState } from "react";
import { LIVE_PREFIX } from "@/lib/evidence/live";

/**
 * Take a photo inside Docket instead of picking a file. The picture comes straight from the camera stream, so the
 * landlord can see it wasn't imported from a gallery or an editing app. (The browser reports this; it's a label, not proof.)
 * Flow: viewfinder → shutter flash → preview with Retake / Use photo.
 */
export function LiveCamera({ onCapture, label = "Take a photo" }: { onCapture: (file: File) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Couldn't open the camera. Allow camera access, or choose a photo instead."));
    return () => {
      cancelled = true;
      stop();
    };
  }, [open]);

  // Free the preview image when it's replaced or the dialog closes.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  function close() {
    setOpen(false);
    setShot(null);
  }

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    // Shutter blink: a quick white flash so it's obvious the photo was taken.
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `${LIVE_PREFIX}${Date.now()}.jpg`, { type: "image/jpeg" });
        setShot({ file, url: URL.createObjectURL(file) });
      },
      "image/jpeg",
      0.92,
    );
  }

  function use() {
    if (!shot) return;
    onCapture(shot.file);
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
      >
        📷 {label}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Camera" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/90 p-4">
          {error ? (
            <p role="alert" className="max-w-sm rounded-lg bg-surface p-4 text-sm">{error}</p>
          ) : (
            <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-ink">
              {/* The stream keeps running behind the preview so Retake is instant. */}
              <video ref={video} autoPlay playsInline muted className={`max-h-[70vh] w-full ${shot ? "invisible" : ""}`} />
              {shot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shot.url} alt="Photo you just took" className="absolute inset-0 h-full w-full object-contain" />
              )}
              <div aria-hidden className={`pointer-events-none absolute inset-0 bg-surface transition-opacity ${flash ? "opacity-90 duration-75" : "opacity-0 duration-300"}`} />
            </div>
          )}
          <div className="flex gap-3">
            {!error && !shot && <button type="button" onClick={snap} className="rounded-lg bg-primary px-5 py-3 font-semibold text-white ring-2 ring-white hover:bg-primary-dark">Take photo</button>}
            {shot && <button type="button" onClick={() => setShot(null)} className="rounded-lg border border-border bg-surface px-5 py-3 text-sm">Retake</button>}
            {shot && <button type="button" onClick={use} className="rounded-lg bg-primary px-5 py-3 font-semibold text-white ring-2 ring-white hover:bg-primary-dark">Use photo</button>}
            <button type="button" onClick={close} className="rounded-lg border border-border bg-surface px-5 py-3 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
