"use client";

import { useState } from "react";
import type { Obligation } from "@/lib/domain/types";
import { deadlineLabelIn, formatDateTime, plainDutyIn } from "@/lib/i18n";
import { useLocale, useT } from "@/components/i18n/I18n";
import { Countdown } from "./Countdown";
import { LawGraphPanel } from "@/components/law/LawGraphPanel";

/**
 * Client-side obligation list so each row's "why?" can open the citation graph
 * panel. The list itself is dumb data + the shared panel instance.
 */
export function ObligationList({
  obligations,
  now,
  role,
  landlordName,
}: {
  obligations: Obligation[];
  now: string;
  role: "tenant" | "landlord";
  landlordName: string;
}) {
  const [selected, setSelected] = useState<Obligation | null>(null);
  return (
    <>
      {obligations.map((o) => (
        <ObligationRow key={o.id} o={o} now={now} role={role} landlordName={landlordName} onWhy={() => setSelected(o)} />
      ))}
      <LawGraphPanel obligation={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function ObligationRow({
  o,
  now,
  role,
  landlordName,
  onWhy,
}: {
  o: Obligation;
  now: string;
  role: "tenant" | "landlord";
  landlordName: string;
  onWhy: () => void;
}) {
  // Inside the landlord section the scope is English, so this stays English there.
  const locale = useLocale();
  const t = useT();
  const kind = deadlineLabelIn(locale, o);
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {role === "tenant" ? (
            plainDutyIn(locale, o, landlordName)
          ) : (
            <>
              <span className="mr-2 text-xs uppercase text-muted">{o.party}</span>
              {o.title}
            </>
          )}
          {o.provisional && <span className="ms-2 text-xs text-warn">{role === "tenant" ? t("obligation.beingChecked") : "provisional"}</span>}
        </p>
        <p className="text-xs text-muted">
          {kind} ·{" "}
          <button type="button" onClick={onWhy} className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark">
            {t("obligation.why")}
          </button>
          {o.legalBasis.url && (
            <>
              {" · "}
              <a href={o.legalBasis.url} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                {o.legalBasis.citation}
              </a>
            </>
          )}
        </p>
        {o.pausedMs > 0 && <p className="text-xs text-muted">{t("obligation.clockPaused", { h: Math.round(o.pausedMs / 3_600_000) })}</p>}
      </div>
      <div className="shrink-0 text-end">
        {o.status === "open" || o.status === "breached" ? (
          <Countdown dueAt={o.dueAt} serverNow={now} />
        ) : (
          <span className="text-sm text-ok">{t(o.status === "met" ? "obligation.doneOnTime" : "obligation.doneLate")}</span>
        )}
        <p className="text-xs text-muted">{formatDateTime(o.dueAt, locale)}</p>
      </div>
    </div>
  );
}
