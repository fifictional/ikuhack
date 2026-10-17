import { compareFixPhotos } from "@/lib/ai/verify-fix";
import { appendEvent, getCase } from "@/lib/cases/service";
import { db } from "@/lib/db/client";

/**
 * Runs the Gemini before/after check on a case and records the result as a `fix.verified` fact.
 * "Unclear" results are returned but not recorded, so a bad photo can't reopen a job by itself.
 */
export async function checkFix(caseId: string) {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");
  if (!c.events.some((e) => e.type === "WORKS_COMPLETED")) {
    return { status: "skipped" as const, reason: "The repair hasn't been marked complete yet." };
  }

  const photos = await db()<{ id: string; mime: string; bytes: Buffer; uploaded_by: string; created_at: Date }[]>`
    SELECT id, mime, bytes, uploaded_by, created_at FROM evidence
    WHERE case_id = ${caseId} AND kind = 'photo' ORDER BY created_at`;
  const after = photos.filter((p) => p.uploaded_by !== "tenant").slice(-2);
  const firstAfter = after[0]?.created_at.getTime() ?? Infinity;
  const before = photos.filter((p) => p.uploaded_by === "tenant" && p.created_at.getTime() < firstAfter).slice(-3);
  if (before.length === 0) return { status: "skipped" as const, reason: "No photo of the problem from the tenant to compare against." };
  if (after.length === 0) return { status: "skipped" as const, reason: "No photo of the finished work yet." };

  const toInline = (p: (typeof photos)[number]) => ({ mimeType: p.mime, data: Buffer.from(p.bytes).toString("base64") });
  const issue = String(c.state.facts["issue.summary"]?.value ?? c.title);
  const result = await compareFixPhotos({ issue, before: before.map(toInline), after: after.map(toInline) });

  if (result.verdict === "unclear" || !result.sameArea) {
    return { status: "unclear" as const, result };
  }
  const sentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const note = [result.observations, ...result.remainingProblems].filter(Boolean).map(sentence).join(" ");
  const { state, revisions } = await appendEvent(caseId, "system", {
    type: "FACT_ASSERTED",
    key: "fix.verified",
    value: result.verdict === "fixed",
    source: { kind: "ai_vision", ref: after.map((p) => p.id).join(","), label: "Gemini photo check" },
    confidence: result.confidence,
    note,
  });
  return { status: "recorded" as const, result, phase: state.phase, revisions };
}
