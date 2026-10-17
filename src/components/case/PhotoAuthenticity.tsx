"use client";

import { useState } from "react";

type Report = {
  verdict: "looks_real" | "needs_review" | "likely_ai_or_edited" | "not_checked";
  signals: { id: string; level: "ok" | "info" | "warn" | "alert"; label: string; detail: string }[];
};

const VERDICT: Record<Report["verdict"], { text: string; cls: string }> = {
  looks_real: { text: "✓ Looks like a real photo", cls: "border-ok text-ok" },
  needs_review: { text: "! Worth a closer look", cls: "border-warn text-warn" },
  likely_ai_or_edited: { text: "✕ Likely AI-made or edited", cls: "border-danger text-danger" },
  not_checked: { text: "Not checked yet", cls: "border-border text-muted" },
};

/** Landlord-only: thumbnail with the automatic AI/edit verdict (run at upload) and how the photo was taken. */
export function PhotoAuthenticity({
  evidenceId, caption, initial, capture,
}: { evidenceId: string; caption?: string; initial?: Report; capture?: string | null }) {
  const [report, setReport] = useState<Report | null>(initial ?? null);
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

  const v = VERDICT[report?.verdict ?? "not_checked"] ?? VERDICT.not_checked;
  const findings = report?.signals.filter((s) => s.level === "warn" || s.level === "alert") ?? [];
  return (
    <div className="space-y-2 rounded-lg border border-border p-2">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/evidence/${evidenceId}`} alt={caption ?? "evidence"} className="h-20 w-20 shrink-0 rounded object-cover" />
        <div className="min-w-0 flex-1 space-y-1">
          {caption && <p className="truncate text-sm">{caption}</p>}
          <p className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.text}</p>
          <p className="text-xs text-muted">{capture === "live" ? "Taken live in Docket's camera" : "Chosen from the tenant's device"}</p>
          <div>
            <button onClick={run} disabled={busy} className="rounded-lg border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary-tint disabled:opacity-60">
              {busy ? "Checking…" : report ? "Re-check" : "Check now"}
            </button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {findings.length > 0 && (
        <ul className="space-y-1 text-xs">
          {findings.map((s) => (
            <li key={s.id}><b>{s.label}.</b> <span className="text-muted">{s.detail}</span></li>
          ))}
        </ul>
      )}
      {report && <p className="text-xs text-muted">Automatic screen, not proof. If in doubt, ask the tenant for the original photo.</p>}
    </div>
  );
}
