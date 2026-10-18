"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntakeDraft } from "@/lib/ai/intake";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/components/i18n/I18n";
import { LiveCamera } from "@/components/case/LiveCamera";
import { captureMethodOf } from "@/lib/evidence/live";
import { PhotoThumbs } from "./PhotoThumbs";
import { VoiceNoteButton } from "./VoiceNoteButton";
import { VoiceReport } from "./VoiceReport";

/**
 * Text/photo reporting: describe → Gemini drafts → tenant answers any follow-up questions (in their language)
 * → confirms → case created → photos stored as evidence.
 * UI text is translated (useT); Gemini's summary and questions come back in the tenant's own language.
 */

const URGENCY_TONE: Record<IntakeDraft["assessedSeverity"], string> = {
  emergency: "text-danger",
  significant: "text-warn",
  routine: "text-muted",
};

type QA = { q: string; a: string };
const compose = (text: string, qa: QA[]) =>
  qa.length ? `${text}\n\nFollow-up answers:\n${qa.map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n")}` : text;
export function ReportFlow() {
  const router = useRouter();
  const t = useT();
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
      form.set("capture", captureMethodOf(p));
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
            {m === "voice" ? t("report.modeSpeak") : t("report.modeType")}
          </button>
        ))}
      </div>

      {mode === "voice" ? (
        <VoiceReport onFallback={() => setMode("type")} />
      ) : !draft ? (
        <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder={t("report.placeholder")}
            className="w-full rounded-lg border border-border bg-surface p-3" />
          <VoiceNoteButton onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-center text-sm font-medium text-primary hover:border-primary hover:bg-primary-tint">
              {t("report.uploadPhotos")}
              <input type="file" accept="image/*" multiple className="sr-only"
                onChange={(e) => setPhotos((prev) => [...prev, ...(e.target.files ?? [])])} />
            </label>
            <LiveCamera label={t("report.takePhoto")} onCapture={(f) => setPhotos((prev) => [...prev, f])} />
          </div>
          {photos.length > 0 && <PhotoThumbs photos={photos} onRemove={(i) => setPhotos((prev) => prev.filter((_, j) => j !== i))} />}
          {photos.length > 0 && (
            <p className="flex items-center justify-between text-sm text-muted">
              <span>{t("report.photosAdded", { n: photos.length, live: photos.filter((p) => captureMethodOf(p) === "live").length })}</span>
              <button type="button" onClick={() => setPhotos([])} className="underline hover:text-primary">{t("report.clear")}</button>
            </p>
          )}
          <button disabled={busy || (!text && photos.length === 0)} onClick={() => analyse()}
            className="w-full rounded-lg bg-primary font-semibold text-white hover:bg-primary-dark py-3 disabled:opacity-50">
            {busy ? t("report.reading") : t("report.continue")}
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">{t("report.understood")}</p>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{draft.title}</h2>
            <p>{draft.tenantSummary}</p>
            {draft.detectedLanguage !== "en" && <p className="text-xs text-muted" dir="ltr" lang="en">{t("report.inEnglish")} {draft.summary}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">{t("report.type")}</dt><dd>{t(`category.${draft.category}` as MessageKey)}</dd>
            {draft.location && (<><dt className="text-muted">{t("report.where")}</dt><dd>{draft.location}</dd></>)}
            <dt className="text-muted">{t("report.howUrgent")}</dt>
            <dd className={URGENCY_TONE[draft.assessedSeverity]}>{t(`urgency.${draft.assessedSeverity}` as MessageKey)}</dd>
          </dl>
          {draft.photoAssessment && <p className="text-sm text-muted">{t("report.fromPhotos")} {draft.photoAssessment.observations}</p>}

          {draft.followUpQuestions.length > 0 && (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm font-medium">{t("report.followUpIntro")}</p>
              {draft.followUpQuestions.map((q, i) => (
                <label key={q} className="block space-y-1 text-sm">
                  <span>{q}</span>
                  <input value={answers[i] ?? ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                </label>
              ))}
              <button disabled={busy || !Object.values(answers).some((a) => a.trim())} onClick={answerFollowUps}
                className="w-full rounded-lg border border-primary py-2 font-medium text-primary hover:bg-primary-tint disabled:opacity-40">
                {busy ? t("report.updating") : t("report.updateAnswers")}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setDraft(null); setQaLog([]); }} className="rounded-lg border border-border px-4 py-3">{t("report.edit")}</button>
            <button disabled={busy} onClick={submit} className="flex-1 rounded-lg bg-primary font-semibold text-white hover:bg-primary-dark py-3 disabled:opacity-50">
              {busy ? t("report.logging") : t("report.logIt")}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
