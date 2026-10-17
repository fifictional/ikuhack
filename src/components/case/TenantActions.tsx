"use client";

import { useState } from "react";
import type { CaseState, EscalationRoute } from "@/lib/domain/types";
import { ESCALATION_LABEL } from "@/lib/ui/labels";
import { Btn } from "./LandlordActions";
import { useCaseAction } from "./useCaseAction";

/** Tenant actions: add evidence, add context, confirm/dispute the fix, escalate. */
export function TenantActions({
  caseId,
  escalationOptions,
  phase,
}: {
  caseId: string;
  escalationOptions: EscalationRoute[];
  phase: CaseState["phase"];
}) {
  const { send, upload, pending, error } = useCaseAction(caseId, "tenant");
  const [letter, setLetter] = useState<{ route: EscalationRoute; text: string } | null>(null);

  async function draft(route: EscalationRoute) {
    const res = await fetch(`/api/cases/${caseId}/letters/${route}`);
    setLetter({ route, text: await res.text() });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4 text-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your actions</h2>

      <label className="block cursor-pointer rounded-md border border-dashed border-border p-3 text-center hover:border-accent">
        Add photo or video
        <input type="file" accept="image/*,video/*" capture="environment" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>

      <Btn disabled={pending} onClick={() => send({ type: "FACT_ASSERTED", key: "household.vulnerable", value: true, source: { kind: "tenant" } })}>
        Someone at home is vulnerable (baby, elderly, ill)
      </Btn>

      {phase === "fixed_pending_confirmation" && (
        <div className="flex gap-2">
          <Btn disabled={pending} onClick={() => send({ type: "TENANT_CONFIRMED_FIXED" })}>It&apos;s fixed</Btn>
          <Btn disabled={pending} onClick={() => {
            const reason = prompt("What's still wrong?");
            if (reason) send({ type: "TENANT_DISPUTED_FIX", reason });
          }}>Not fixed</Btn>
        </div>
      )}

      {escalationOptions.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="font-medium text-danger">Your landlord has missed a legal deadline.</p>
          {escalationOptions.map((r) => (
            <Btn key={r} className="w-full text-left" onClick={() => draft(r)}>{ESCALATION_LABEL[r]}</Btn>
          ))}
        </div>
      )}

      {letter && (
        <div className="space-y-2">
          <textarea readOnly value={letter.text} className="h-64 w-full rounded border border-border p-2 font-mono text-xs" />
          <p className="text-xs text-muted">Docket drafts this for you to check and send. It is legal information, not legal advice.</p>
          <Btn disabled={pending} onClick={() => { send({ type: "ESCALATED", route: letter.route }); setLetter(null); }}>
            I&apos;ve sent it — log it
          </Btn>
        </div>
      )}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
