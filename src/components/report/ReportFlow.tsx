"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntakeDraft } from "@/lib/ai/intake";
import { CATEGORY_LABEL } from "@/lib/ui/labels";
import { VoiceNoteButton } from "./VoiceNoteButton";
import { VoiceReport } from "./VoiceReport";

/**
 * Text/photo reporting: describe → Gemini drafts → tenant answers any follow-up questions (in their language)
 * → confirms → case created → photos stored as evidence.
 * TODO(person A): accessibility pass, i18n of UI copy.
 */

const URGENCY: Record<IntakeDraft["assessedSeverity"], { label: string; tone: string }> = {
  emergency: { label: "Emergency — needs action within 24 hours", tone: "text-danger" },
  significant: { label: "Urgent — could affect your health or home", tone: "text-warn" },
  routine: { label: "Routine repair", tone: "text-muted" },
};

type QA = { q: string; a: string };
const compose = (text: string, qa: QA[]) =>
  qa.length ? `${text}\n\nFollow-up answers:\n${qa.map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n")}` : text;
export function ReportFlow() {
  const router = useRouter();
  // Typing is the default while VOICE_ENABLED=false; switch to "voice" for the demo.
  const [mode, setMode] = useState<"voice" | "type">("type");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qaLog, setQaLog] = useState<QA[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  async function analyse(qa: QA[] = qaLog) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("text", compose(text, qa));
    photos.forEach((p) => form.append("photos", p));
    const res = await fetch("/api/intake", { method: "POST", body: form });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.error);
    setDraft(body.draft);
    setAnswers({});
  }

  /** Fold the tenant's answers into the report and let Gemini re-classify with the extra detail. */
  function answerFollowUps() {
    if (!draft) return;
    const answered = draft.followUpQuestions.flatMap((q, i) => (answers[i]?.trim() ? [{ q, a: answers[i].trim() }] : []));
    const next = [...qaLog, ...answered];
    setQaLog(next);
    analyse(next);
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: compose(text, qaLog) || draft.summary, channel: photos.length ? "photo" : "text", draft }),
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
            className={`rounded-full px-3 py-1 font-medium ${mode === m ? "bg-primary text-white" : "border border-border bg-surface text-ink hover:border-primary"}`}>
            {m === "voice" ? "Speak" : "Type & photos"}
          </button>
        ))}
      </div>

      {mode === "voice" ? (
        <VoiceReport onFallback={() => setMode("type")} />
      ) : !draft ? (
        <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder="e.g. Black mould is spreading on the bedroom wall and my baby keeps coughing"
            className="w-full rounded-lg border border-border bg-surface p-3" />
          <VoiceNoteButton onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-sm font-medium text-primary hover:border-primary hover:bg-primary-tint">
            {photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} added — change` : "Add photos (optional)"}
            <input type="file" accept="image/*" multiple capture="environment" className="sr-only"
              onChange={(e) => setPhotos([...(e.target.files ?? [])])} />
          </label>
          <button disabled={busy || (!text && photos.length === 0)} onClick={() => analyse()}
            className="w-full rounded-lg bg-primary font-semibold text-white hover:bg-primary-dark py-3 disabled:opacity-50">
            {busy ? "Reading your report…" : "Continue"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Here&apos;s what we understood. Is this right?</p>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{draft.title}</h2>
            <p>{draft.tenantSummary}</p>
            {draft.detectedLanguage !== "en" && <p className="text-xs text-muted">In English: {draft.summary}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Type</dt><dd>{CATEGORY_LABEL[draft.category]}</dd>
            {draft.location && (<><dt className="text-muted">Where</dt><dd>{draft.location}</dd></>)}
            <dt className="text-muted">How urgent</dt>
            <dd className={URGENCY[draft.assessedSeverity].tone}>{URGENCY[draft.assessedSeverity].label}</dd>
          </dl>
          {draft.photoAssessment && <p className="text-sm text-muted">From your photos: {draft.photoAssessment.observations}</p>}

          {draft.followUpQuestions.length > 0 && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm font-medium">A couple of quick questions help us get this right (optional):</p>
              {draft.followUpQuestions.map((q, i) => (
                <label key={q} className="block space-y-1 text-sm">
                  <span>{q}</span>
                  <input value={answers[i] ?? ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </label>
              ))}
              <button disabled={busy || !Object.values(answers).some((a) => a.trim())} onClick={answerFollowUps}
                className="w-full rounded-lg border border-primary py-2 font-medium text-primary hover:bg-primary-tint disabled:opacity-40">
                {busy ? "Updating…" : "Update with my answers"}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setDraft(null); setQaLog([]); }} className="rounded-lg border border-border px-4 py-3">Edit</button>
            <button disabled={busy} onClick={submit} className="flex-1 rounded-lg bg-primary font-semibold text-white hover:bg-primary-dark py-3 disabled:opacity-50">
              {busy ? "Logging…" : "Log it with my landlord"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
