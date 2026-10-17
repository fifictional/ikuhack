"use client";

import { useState } from "react";
import { CATEGORIES, SEVERITIES, type CaseEvent, type EventBody } from "@/lib/domain/types";
import { useCaseAction } from "./useCaseAction";

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
      <Btn disabled={busy} onClick={() => landlord.send({ type: "ACKNOWLEDGED" })}>Acknowledge</Btn>

      <div className="space-y-1">
        <label className="block text-xs text-muted">Book access (24h written notice required)</label>
        <input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full rounded border border-border px-2 py-1" />
        <Btn disabled={busy || !slot} onClick={() => landlord.send({ type: "ACCESS_PROPOSED", slotStart: new Date(slot).toISOString() })}>
          Send access notice
        </Btn>
      </div>

      {openProposal && (
        <div className="flex flex-wrap gap-2">
          <Btn disabled={busy} onClick={() => pro.send({ type: "ACCESS_OUTCOME", proposalId: openProposal.id, outcome: "completed" })}>Visit done</Btn>
          <Btn disabled={busy} onClick={() => pro.send({ type: "ACCESS_OUTCOME", proposalId: openProposal.id, outcome: "tenant_no_access" })}>No access</Btn>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex gap-2">
          <span className="text-xs text-muted">Record findings as</span>
          <select value={proKind} onChange={(e) => setProKind(e.target.value as typeof proKind)} className="rounded border border-border text-xs">
            <option value="contractor">contractor</option>
            <option value="surveyor">surveyor</option>
          </select>
        </div>
        <select defaultValue="" onChange={(e) => e.target.value && assert("issue.category", e.target.value)} className="w-full rounded border border-border px-2 py-1">
          <option value="" disabled>Reclassify category…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select defaultValue="" onChange={(e) => e.target.value && assert("issue.severity", e.target.value)} className="w-full rounded border border-border px-2 py-1">
          <option value="" disabled>Assess severity…</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Btn disabled={busy} onClick={() => assert("cause.tenantDamage", true)}>Damage caused by household</Btn>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Btn disabled={busy} onClick={() => pro.send({ type: "INVESTIGATION_COMPLETED", findings: "Inspection completed" })}>Investigation done</Btn>
        <Btn disabled={busy} onClick={() => landlord.send({ type: "SUMMARY_SENT", summary: "Summary sent" })}>Summary sent</Btn>
        <Btn disabled={busy} onClick={() => pro.send({ type: "MADE_SAFE" })}>Made safe</Btn>
        <Btn disabled={busy} onClick={() => pro.send({ type: "WORKS_STARTED" })}>Works started</Btn>
        <Btn disabled={busy} onClick={() => pro.send({ type: "WORKS_COMPLETED" })}>Works complete</Btn>
      </div>
      {(landlord.error || pro.error) && <p className="text-danger">{landlord.error ?? pro.error}</p>}
    </div>
  );
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-teal hover:text-teal disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}
