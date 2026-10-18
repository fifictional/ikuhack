"use client";

import { useState } from "react";
import type { CaseState, EscalationRoute } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/components/i18n/I18n";
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
  const t = useT();
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("actions.title")}</h2>

      {escalationOptions.length > 0 && (
        <div id="escalate" className="scroll-mt-4 space-y-2 rounded-lg border border-danger bg-danger/5 p-3">
          <p className="font-semibold text-danger">{t("actions.escalateTitle")}</p>
          <div className="space-y-2">
            {escalationOptions.map((r, i) => (
              <button
                key={r}
                type="button"
                disabled={drafting !== null}
                onClick={() => draft(r)}
                className={`w-full rounded-md px-3 py-2 text-start text-sm disabled:opacity-50 ${
                  i === 0
                    ? "bg-primary font-semibold text-white hover:bg-primary-dark"
                    : "border border-border bg-surface hover:border-primary hover:text-primary"
                }`}
              >
                {drafting === r ? t("actions.drafting") : `${i + 1} · ${t(`escalation.${r}` as MessageKey)}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{t("actions.order")}</p>

          {letter && (
            <div className="space-y-2 pt-1">
              {/* The letter itself stays in English: it goes to the landlord, council or court. */}
              <textarea readOnly dir="ltr" lang="en" value={letter.text} className="h-64 w-full rounded border border-border p-2 font-mono text-xs" />
              <p className="text-xs text-muted">{t("actions.letterNote")}</p>
              <Btn
                disabled={pending}
                onClick={() => {
                  send({ type: "ESCALATED", route: letter.route });
                  setLetter(null);
                }}
              >
                {t("actions.sentIt")}
              </Btn>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("actions.addToCase")}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border p-3 text-center hover:border-primary hover:bg-primary-tint">
            {t("actions.upload")}
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <LiveCamera label={t("actions.takePhoto")} onCapture={(f) => upload(f)} />
        </div>
      </div>

      {phase === "fixed_pending_confirmation" && (
        <div className="flex gap-2">
          <Btn disabled={pending} onClick={() => send({ type: "TENANT_CONFIRMED_FIXED" })}>{t("actions.fixed")}</Btn>
          <Btn
            disabled={pending}
            onClick={() => {
              const reason = prompt(t("actions.whatsWrong"));
              if (reason) send({ type: "TENANT_DISPUTED_FIX", reason });
            }}
          >
            {t("actions.notFixed")}
          </Btn>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="font-medium">{t("actions.vulnerableQ")}</p>
        <p className="text-xs text-muted">{t("actions.vulnerableHint")}</p>
        {vulnerable ? (
          <p className="text-xs text-muted">{t("actions.vulnerableYes")}</p>
        ) : answeredNo ? (
          <p className="text-xs text-muted">{t("actions.vulnerableNo")}</p>
        ) : (
          <div className="flex gap-2">
            <Btn
              disabled={pending}
              onClick={() => send({ type: "FACT_ASSERTED", key: "household.vulnerable", value: true, source: { kind: "tenant" } })}
            >
              {t("common.yes")}
            </Btn>
            <Btn disabled={pending} onClick={() => setAnsweredNo(true)}>{t("common.no")}</Btn>
          </div>
        )}
      </div>

      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
