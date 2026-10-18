"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseState } from "@/lib/domain/types";
import { PHASE_LABEL, fmtDateTime, fmtDay, plainDuty } from "@/lib/ui/labels";

/**
 * Scrubs through the moments Docket changed its mind: each stop is a revision
 * timestamp. The server re-projects the case at that time, so this shows the
 * belief as it stood then — not the current state with old labels. The previous
 * snapshot stays on screen until the new one lands, then fades in gently.
 */
export function BeliefTimeline({
  caseId,
  now,
  openedAt,
  revisions,
  landlordName,
  breachedNow,
}: {
  caseId: string;
  now: string;
  openedAt: string;
  revisions: { at: string }[];
  landlordName: string;
  breachedNow: boolean;
}) {
  const stops = useMemo(() => {
    const times = [openedAt, ...revisions.map((r) => r.at), now]
      .map((t) => new Date(t).getTime())
      .sort((a, b) => a - b);
    return [...new Set(times)];
  }, [openedAt, revisions, now]);

  const [index, setIndex] = useState(stops.length - 1);
  const [state, setState] = useState<CaseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [shownAt, setShownAt] = useState<string | null>(null);

  // Clamp on render so a moved demo clock can't push the thumb out of range.
  const idx = Math.max(0, Math.min(index, stops.length - 1));
  const at = stops[idx] ?? new Date(now).getTime();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      fetch(`/api/cases/${caseId}/state?at=${encodeURIComponent(new Date(at).toISOString())}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then((j) => {
          if (cancelled) return;
          setState(j.state as CaseState);
          setShownAt(new Date(at).toISOString());
        })
        .catch(() => !cancelled && setState(null))
        .finally(() => !cancelled && setLoading(false));
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [caseId, at]);

  const isNow = idx === stops.length - 1;
  const open = state?.obligations.filter((o) => o.status === "open" || o.status === "breached") ?? [];
  const met = state?.obligations.filter((o) => o.status === "met" || o.status === "met_late") ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Drag to see exactly what Docket knew at any moment. Useful as proof.</p>

      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <p>
          Showing <b className="text-foreground">{fmtDateTime(new Date(at).toISOString())}</b>
          {isNow && " (now)"}
        </p>
        <span>
          Snapshot {idx + 1} of {stops.length}
        </span>
      </div>

      <RangeSlider index={idx} count={stops.length} onChange={setIndex} />
      <div className="flex justify-between gap-3 text-[11px] text-muted">
        <span>Report made · {fmtDay(new Date(stops[0]).toISOString())}</span>
        <span>
          {breachedNow ? "Deadlines missed" : "Now"} · {fmtDay(new Date(stops[stops.length - 1]).toISOString())}
        </span>
      </div>

      {loading && !state && <p className="text-sm text-muted">Re-projecting…</p>}

      {state && (
        <div key={shownAt ?? "first"} className="bt-fade space-y-2">
          <p className="text-xs text-muted">
            Phase: <span className="text-foreground">{PHASE_LABEL[state.phase]}</span>
            {met.length > 0 && <> · {met.length} done by this point</>}
          </p>
          {open.length === 0 ? (
            <p className="text-sm text-muted">No open duties at this point.</p>
          ) : (
            <ul className="space-y-1.5">
              {open.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{plainDuty(o, landlordName)}</span>
                  <span
                    className={`shrink-0 whitespace-nowrap text-xs ${
                      o.status === "breached" ? "text-danger" : "text-warn"
                    }`}
                  >
                    {o.status === "breached" ? "Breached" : "Open"} · {fmtDay(o.dueAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {state.notes.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {state.notes.slice(0, 3).map((n) => (
                <li key={n}>ℹ️ {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && !state && <p className="text-sm text-danger">Couldn&apos;t re-project this case.</p>}

      <style>{`
        @keyframes bt-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        .bt-fade { animation: bt-fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1); }

        .bt-track {
          position: relative;
          height: 1.75rem;
          cursor: pointer;
          touch-action: none;
          user-select: none;
        }
        .bt-track-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          margin-top: -2px;
          height: 4px;
          border-radius: 9999px;
          background: var(--border);
        }
        .bt-fill {
          position: absolute;
          left: 0;
          top: 50%;
          margin-top: -2px;
          height: 4px;
          border-radius: 9999px;
          background: var(--primary);
          transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bt-dot {
          position: absolute;
          top: 50%;
          width: 6px;
          height: 6px;
          margin-left: -3px;
          margin-top: -3px;
          border-radius: 9999px;
          background: var(--muted);
          opacity: 0.5;
          pointer-events: none;
        }
        .bt-thumb {
          position: absolute;
          top: 50%;
          width: 1.25rem;
          height: 1.25rem;
          border-radius: 9999px;
          background: var(--primary);
          border: 2px solid var(--surface);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transform: translate(-50%, -50%);
          transition: left 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bt-thumb:active {
          transform: translate(-50%, -50%) scale(1.12);
        }
      `}</style>
    </div>
  );
}

/** A native-feeling slider whose thumb glides between snapshot stops instead of snapping. */
function RangeSlider({
  index,
  count,
  onChange,
}: {
  index: number;
  count: number;
  onChange: (i: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const pct = count <= 1 ? 0 : (index / (count - 1)) * 100;

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || count <= 1) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    onChange(Math.round(ratio * (count - 1)));
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Choose a point in time"
      aria-valuemin={0}
      aria-valuemax={Math.max(count - 1, 0)}
      aria-valuenow={index}
      className="bt-track"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(Math.max(index - 1, 0));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(Math.min(index + 1, count - 1));
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(0);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(count - 1);
        }
      }}
    >
      <div className="bt-track-line" />
      <div className="bt-fill" style={{ width: `${pct}%` }} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bt-dot" style={{ left: `${count <= 1 ? 0 : (i / (count - 1)) * 100}%` }} />
      ))}
      <div className="bt-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}
