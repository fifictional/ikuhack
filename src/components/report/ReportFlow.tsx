"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntakeDraft } from "@/lib/ai/intake";
import { CATEGORY_LABEL } from "@/lib/ui/labels";
import { VoiceReport } from "./VoiceReport";

/**
 * Text/photo reporting: describe → Gemini drafts → tenant confirms → case created → photos stored as evidence.
 * TODO(person A): voice-note button (record → /api/transcribe → fills the textarea), accessibility pass, i18n of UI copy.
 */
export function ReportFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<"voice" | "type">("voice");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("text", text);
    photos.forEach((p) => form.append("photos", p));
    const res = await fetch("/api/intake", { method: "POST", body: form });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.error);
    setDraft(body.draft);
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: text || draft.summary, channel: photos.length ? "photo" : "text", draft }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(body.error);
    }
    for (const p of photos) {
      const form = new FormData();
      form.set("file", p);
      form.set("actor", "tenant");
      form.set("kind", "photo");
      await fetch(`/api/cases/${body.caseId}/evidence`, { method: "POST", body: form });
    }
    router.push(`/tenant/cases/${body.caseId}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        {(["voice", "type"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 ${mode === m ? "bg-foreground text-background" : "border border-border"}`}>
            {m === "voice" ? "Speak" : "Type & photos"}
          </button>
        ))}
      </div>

      {mode === "voice" ? (
        <VoiceReport />
      ) : !draft ? (
        <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder="e.g. Black mould is spreading on the bedroom wall and my baby keeps coughing"
            className="w-full rounded-lg border border-border bg-surface p-3" />
          <input type="file" accept="image/*" multiple capture="environment"
            onChange={(e) => setPhotos([...(e.target.files ?? [])])} />
          <button disabled={busy || (!text && photos.length === 0)} onClick={analyse}
            className="w-full rounded-lg bg-accent py-2 text-white disabled:opacity-50">
            {busy ? "Reading your report…" : "Continue"}
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Here&apos;s what we understood — is this right?</p>
          <h2 className="text-lg font-semibold">{draft.title}</h2>
          <p className="text-sm">{draft.summary}</p>
          <p className="text-sm">Type: <b>{CATEGORY_LABEL[draft.category]}</b>{draft.location && <> · Where: <b>{draft.location}</b></>}</p>
          {draft.photoAssessment && <p className="text-sm text-muted">From your photos: {draft.photoAssessment.observations}</p>}
          {/* TODO(person A): let the tenant answer followUpQuestions inline before submitting. */}
          <div className="flex gap-2">
            <button onClick={() => setDraft(null)} className="rounded-lg border border-border px-4 py-2">Edit</button>
            <button disabled={busy} onClick={submit} className="flex-1 rounded-lg bg-accent py-2 text-white disabled:opacity-50">
              {busy ? "Logging…" : "Log it with my landlord"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
