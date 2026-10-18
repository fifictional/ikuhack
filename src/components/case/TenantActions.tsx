"use client";

import { useState } from "react";
import type { CaseState, EscalationRoute } from "@/lib/domain/types";
import { ESCALATION_LABEL } from "@/lib/ui/labels";
import { Btn } from "./LandlordActions";
import { LiveCamera } from "./LiveCamera";
import { useCaseAction } from "./useCaseAction";

/** Tenant actions: add evidence, add context, confirm/dispute the fix, escalate. */
export function TenantActions({
  caseId,
  escalationOptions,
  phase,
  vulnerable,
}: {
  caseId: string;
  escalationOptions: EscalationRoute[];
  phase: CaseState["phase"];
  vulnerable: boolean;
}) {
  const { send, upload, pending, error } = useCaseAction(caseId, "tenant");
  const [letter, setLetter] = useState<{ route: EscalationRoute; text: string } | null>(null);
  const [drafting, setDrafting] = useState<EscalationRoute | null>(null);
  const [answeredNo, setAnsweredNo] = useState(false);

  async function draft(route: EscalationRoute) {
    setDrafting(route);
    try {
      const res = await fetch(`/api/cases/${caseId}/letters/${route}`);
      setLetter({ route, text: await res.text() });
    } finally {
      setDrafting(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4 text-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your actions</h2>

      {escalationOptions.length > 0 && (
        <div id="escalate" className="scroll-mt-4 space-y-2 rounded-lg border border-danger bg-danger/5 p-3">
          <p className="font-semibold text-danger">Escalate: your landlord missed a legal deadline</p>
          <div className="space-y-2">
            {escalationOptions.map((r, i) => (
              <button
                key={r}
                type="button"
                disabled={drafting !== null}
                onClick={() => draft(r)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm disabled:opacity-50 ${
                  i === 0
                    ? "bg-primary font-semibold text-white hover:bg-primary-dark"
                    : "border border-border bg-surface hover:border-primary hover:text-primary"
                }`}
              >
                {drafting === r ? "Drafting…" : `${i + 1} · ${ESCALATION_LABEL[r]}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Usually done in this order.</p>

          {letter && (
            <div className="space-y-2 pt-1">
              <textarea readOnly value={letter.text} className="h-64 w-full rounded border border-border p-2 font-mono text-xs" />
              <p className="text-xs text-muted">Docket drafts this for you to check and send. It is legal information, not legal advice.</p>
              <Btn
                disabled={pending}
                onClick={() => {
                  send({ type: "ESCALATED", route: letter.route });
                  setLetter(null);
                }}
              >
                I&apos;ve sent it — log it
              </Btn>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Add to your case</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border p-3 text-center hover:border-primary hover:bg-primary-tint">
            Upload photo or video
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <LiveCamera label="Take a photo now" onCapture={(f) => upload(f)} />
        </div>
      </div>

      {phase === "fixed_pending_confirmation" && (
        <div className="flex gap-2">
          <Btn disabled={pending} onClick={() => send({ type: "TENANT_CONFIRMED_FIXED" })}>It&apos;s fixed</Btn>
          <Btn
            disabled={pending}
            onClick={() => {
              const reason = prompt("What's still wrong?");
              if (reason) send({ type: "TENANT_DISPUTED_FIX", reason });
            }}
          >
            Not fixed
          </Btn>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="font-medium">Is anyone at home vulnerable?</p>
        <p className="text-xs text-muted">A baby, an older person or someone who is ill or disabled.</p>
        {vulnerable ? (
          <p className="text-xs text-muted">Noted — Docket will treat this case as more urgent.</p>
        ) : answeredNo ? (
          <p className="text-xs text-muted">Thanks — we&apos;ve noted no one is vulnerable.</p>
        ) : (
          <div className="flex gap-2">
            <Btn
              disabled={pending}
              onClick={() => send({ type: "FACT_ASSERTED", key: "household.vulnerable", value: true, source: { kind: "tenant" } })}
            >
              Yes
            </Btn>
            <Btn disabled={pending} onClick={() => setAnsweredNo(true)}>No</Btn>
          </div>
        )}
      </div>

      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
