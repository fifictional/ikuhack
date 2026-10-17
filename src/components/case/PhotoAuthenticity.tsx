"use client";

import { useState } from "react";

type Level = "ok" | "info" | "warn" | "alert";
type Report = {
  verdict: "no_concerns" | "unverified" | "needs_review" | "likely_manipulated";
  signals: { id: string; level: Level; label: string; detail: string }[];
};

const VERDICT: Record<Report["verdict"], { text: string; cls: string }> = {
  no_concerns: { text: "No signs of tampering", cls: "border-primary bg-primary-tint text-ink" },
  unverified: { text: "Can't verify: no camera data", cls: "border-border bg-surface text-ink" },
  needs_review: { text: "Worth a closer look", cls: "border-warn text-warn" },
  likely_manipulated: { text: "Likely edited or AI-made", cls: "border-danger text-danger" },
};
const MARK: Record<Level, string> = { ok: "✓", info: "•", warn: "!", alert: "✕" };
const MARK_CLS: Record<Level, string> = { ok: "text-ok", info: "text-muted", warn: "text-warn", alert: "text-danger" };

/** Landlord-only: thumbnail plus an on-demand authenticity check (metadata, provenance and a visual look). */
export function PhotoAuthenticity({ evidenceId, caption }: { evidenceId: string; caption?: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/authenticity${report ? "?refresh=1" : ""}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Check failed");
      setReport(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  const v = report && VERDICT[report.verdict];
  return (
    <div className="space-y-2 rounded-lg border border-border p-2">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/evidence/${evidenceId}`} alt={caption ?? "evidence"} className="h-20 w-20 shrink-0 rounded object-cover" />
        <div className="min-w-0 flex-1 space-y-1">
          {caption && <p className="truncate text-sm">{caption}</p>}
          {v ? <p className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.text}</p> : null}
          <div>
            <button onClick={run} disabled={busy} className="rounded-lg border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary-tint disabled:opacity-60">
              {busy ? "Checking…" : report ? "Re-check" : "Check authenticity"}
            </button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {report && (
        <>
          <ul className="space-y-1 text-xs">
            {report.signals.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span aria-hidden className={`w-3 shrink-0 text-center font-bold ${MARK_CLS[s.level]}`}>{MARK[s.level]}</span>
                <span><b>{s.label}.</b> <span className="text-muted">{s.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Indicative only. No tool can prove a photo is genuine or fake; ask the tenant for the original file if in doubt.</p>
        </>
      )}
    </div>
  );
}
