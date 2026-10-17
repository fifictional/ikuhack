"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseState } from "@/lib/domain/types";
import { PHASE_LABEL, fmtDateTime, plainDuty } from "@/lib/ui/labels";

/**
 * Scrubs through the moments Docket changed its mind: each stop is a revision
 * timestamp. The server re-projects the case at that time, so this shows the
 * belief as it stood then — not the current state with old labels.
 */
export function BeliefTimeline({
  caseId,
  now,
  openedAt,
  revisions,
  landlordName,
}: {
  caseId: string;
  now: string;
  openedAt: string;
  revisions: { at: string }[];
  landlordName: string;
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

  useEffect(() => {
    setIndex((i) => Math.min(i, stops.length - 1));
  }, [stops.length]);

  const at = stops[Math.min(index, stops.length - 1)] ?? new Date(now).getTime();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/cases/${caseId}/state?at=${encodeURIComponent(new Date(at).toISOString())}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then((j) => !cancelled && setState(j.state as CaseState))
        .catch(() => !cancelled && setState(null))
        .finally(() => !cancelled && setLoading(false));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [caseId, at]);

  const isNow = at === stops[stops.length - 1];
  const open = state?.obligations.filter((o) => o.status === "open" || o.status === "breached") ?? [];
  const met = state?.obligations.filter((o) => o.status === "met" || o.status === "met_late") ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <p>
          Believed at <b className="text-foreground">{fmtDateTime(new Date(at).toISOString())}</b>
          {isNow && " (now)"}
        </p>
        <span>
          {index + 1} / {stops.length}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(stops.length - 1, 0)}
        step={1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Choose a point in time"
      />
      <div className="flex justify-between text-[11px] text-muted">
        <span>{fmtDateTime(new Date(stops[0]).toISOString())}</span>
        <span>{fmtDateTime(new Date(stops[stops.length - 1]).toISOString())}</span>
      </div>

      {loading && <p className="text-sm text-muted">Re-projecting…</p>}

      {!loading && state && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Phase: <span className="text-foreground">{PHASE_LABEL[state.phase]}</span>
            {met.length > 0 && <> · {met.length} done by this point</>}
          </p>
          {open.length === 0 ? (
            <p className="text-sm text-muted">No open duties at this point.</p>
          ) : (
            <ul className="space-y-1.5">
              {open.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 text-sm">
                  <span>{plainDuty(o, landlordName)}</span>
                  <span className={`shrink-0 text-xs ${o.status === "breached" ? "text-danger" : "text-warn"}`}>
                    {o.status === "breached" ? "breached" : "open"} · {fmtDateTime(o.dueAt)}
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
    </div>
  );
}
