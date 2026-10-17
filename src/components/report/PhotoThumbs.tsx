"use client";

import { useState } from "react";
import { captureMethodOf } from "@/lib/evidence/live";

/** Thumbnails of the photos about to be submitted, with a remove button and a "live" tag on camera shots. */
export function PhotoThumbs({ photos, onRemove }: { photos: File[]; onRemove: (index: number) => void }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <li key={`${p.name}-${p.size}-${i}`} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface">
          <Thumb file={p} alt={`Photo ${i + 1}`} />
          {captureMethodOf(p) === "live" && (
            <span className="absolute bottom-1 left-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-white">Taken live</span>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove photo ${i + 1}`}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-xs text-white hover:bg-ink"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Object URL created once per file. It isn't revoked on unmount: strict-mode dev re-runs effects and would leave a
 * revoked (broken) URL behind, and these few small previews live only as long as the report page.
 */
function Thumb({ file, alt }: { file: File; alt: string }) {
  const [url] = useState(() => URL.createObjectURL(file));
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-full w-full object-cover" />;
}
