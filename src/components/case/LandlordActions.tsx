"use client";

import { useState } from "react";
import { CATEGORIES, SEVERITIES, type CaseEvent, type EventBody } from "@/lib/domain/types";
import { CATEGORY_LABEL, SEVERITY_PLAIN } from "@/lib/ui/labels";
import { LiveCamera } from "./LiveCamera";
import { type FixCheckResponse, useCaseAction } from "./useCaseAction";

/**
 * Landlord / contractor / surveyor actions. Facts recorded here carry a
 * professional source, so they outrank the tenant's or the AI's — and can make
 * the engine abandon earlier conclusions.
 * TODO(person B): split contractor/surveyor into their own lightweight views.
 */
export function LandlordActions({ caseId, events }: { caseId: string; events: CaseEvent[] }) {
  const landlord = useCaseAction(caseId, "landlord");
  const pro = useCaseAction(caseId, "contractor");
  const [slot, setSlot] = useState("");
  const [proKind, setProKind] = useState<"contractor" | "surveyor">("contractor");
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<FixCheckResponse | null>(null);
  const completed = events.some((e) => e.type === "WORKS_COMPLETED");

  /** Upload the "after" photo, mark the job done, then have Gemini compare it with the tenant's photos. */
  async function completeWithPhoto() {
    setCheck(null);
    if (afterPhoto) await pro.upload(afterPhoto, "After repair");
    await pro.send({ type: "WORKS_COMPLETED", notes: afterPhoto ? "Completed with after photo" : undefined });
    if (afterPhoto) await runCheck();
    setAfterPhoto(null);
  }

  async function runCheck() {
    setChecking(true);
    setCheck(await pro.checkFix());
    setChecking(false);
  }
  const openProposal = [...events].reverse().find(
    (e) => e.type === "ACCESS_PROPOSED" && !events.some((o) => o.type === "ACCESS_OUTCOME" && o.proposalId === e.id),
  );

  const assert = (key: string, value: unknown) =>
    pro.send({
      type: "FACT_ASSERTED",
      key,
      value,
      source: { kind: proKind, label: proKind === "contractor" ? "Contractor" : "Surveyor" },
    } as EventBody);

  const busy = landlord.pending || pro.pending;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4 text-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Landlord actions</h2>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Respond</p>
        <Btn className="w-full" disabled={busy} onClick={() => landlord.send({ type: "ACKNOWLEDGED" })}>
          Acknowledge the report
        </Btn>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Book access</p>
        <label className="block text-xs text-muted">24h written notice required</label>
        <input
          type="datetime-local"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5"
        />
        <Btn className="w-full" disabled={busy || !slot} onClick={() => landlord.send({ type: "ACCESS_PROPOSED", slotStart: new Date(slot).toISOString() })}>
          Send access notice
        </Btn>
        {openProposal && (
          <div className="grid grid-cols-2 gap-2">
            <Btn disabled={busy} onClick={() => pro.send({ type: "ACCESS_OUTCOME", proposalId: openProposal.id, outcome: "completed" })}>
              Visit done
            </Btn>
            <Btn disabled={busy} onClick={() => pro.send({ type: "ACCESS_OUTCOME", proposalId: openProposal.id, outcome: "tenant_no_access" })}>
              No access
            </Btn>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Record findings as</p>
          <select
            value={proKind}
            onChange={(e) => setProKind(e.target.value as typeof proKind)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
          >
            <option value="contractor">Contractor</option>
            <option value="surveyor">Surveyor</option>
          </select>
        </div>
        <select
          defaultValue=""
          onChange={(e) => e.target.value && assert("issue.category", e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5"
        >
          <option value="" disabled>
            Reclassify category…
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          defaultValue=""
          onChange={(e) => e.target.value && assert("issue.severity", e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5"
        >
          <option value="" disabled>
            Assess severity…
          </option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_PLAIN[s]}
            </option>
          ))}
        </select>
        <Btn className="w-full" disabled={busy} onClick={() => assert("cause.tenantDamage", true)}>
          Damage caused by household
        </Btn>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Update progress</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn disabled={busy} onClick={() => pro.send({ type: "INVESTIGATION_COMPLETED", findings: "Inspection completed" })}>
            Investigation done
          </Btn>
          <Btn disabled={busy} onClick={() => landlord.send({ type: "SUMMARY_SENT", summary: "Summary sent" })}>
            Summary sent
          </Btn>
          <Btn disabled={busy} onClick={() => pro.send({ type: "MADE_SAFE" })}>
            Made safe
          </Btn>
          <Btn disabled={busy} onClick={() => pro.send({ type: "WORKS_STARTED" })}>
            Works started
          </Btn>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Finish the job</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-surface px-3 py-2 text-center text-primary hover:border-primary hover:bg-primary-tint">
            {afterPhoto ? `After photo: ${afterPhoto.name.startsWith("docket-live-") ? "taken now" : afterPhoto.name}` : "Upload an after photo"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setAfterPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <LiveCamera label="Take it now" onCapture={setAfterPhoto} />
        </div>
        <button
          disabled={busy || checking}
          onClick={completeWithPhoto}
          className="w-full rounded-lg bg-primary px-3 py-2 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {checking ? "Gemini is checking the photos…" : "Mark works complete"}
        </button>
        {completed && !checking && (
          <Btn className="w-full" onClick={runCheck}>
            Re-check photos with Gemini
          </Btn>
        )}
        {check && <FixCheckResult check={check} />}
      </div>
      {(landlord.error || pro.error) && <p className="text-danger">{landlord.error ?? pro.error}</p>}
    </div>
  );
}

function FixCheckResult({ check }: { check: FixCheckResponse }) {
  if (check.status === "skipped") return <p className="text-xs text-muted">Photo check skipped: {check.reason}</p>;
  if (!check.result) return check.error ? <p className="text-xs text-danger">{check.error}</p> : null;
  const r = check.result;
  const tone = check.status === "unclear" ? "border-border bg-background" : r.verdict === "fixed" ? "border-primary bg-primary-tint" : "border-highlight bg-highlight-tint";
  const label = check.status === "unclear" ? "Photos don't show enough to tell" : r.verdict === "fixed" ? "Looks fixed" : "Not fixed yet";
  return (
    <div className={`rounded-lg border p-3 text-xs ${tone}`}>
      <p className="font-semibold text-ink">Gemini photo check: {label} ({Math.round(r.confidence * 100)}% sure)</p>
      <p className="mt-1 text-ink">{r.observations}</p>
      {r.remainingProblems.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-ink">{r.remainingProblems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
    </div>
  );
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-primary hover:text-primary disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}
