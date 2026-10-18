"use client";

import { useState } from "react";
import type { Obligation } from "@/lib/domain/types";
import { dutyTypeIn, formatDateTime, plainDutyIn } from "@/lib/i18n";
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
      {/* Keyed by duty id so opening a different one remounts the panel and resets its selection. */}
      <LawGraphPanel key={selected?.id ?? "none"} obligation={selected} onClose={() => setSelected(null)} />
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
  const type = dutyTypeIn(locale, o);
  const live = o.status === "open" || o.status === "breached";

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {role === "tenant" ? (
            plainDutyIn(locale, o, landlordName)
          ) : (
            <>
              <span className="me-2 text-xs uppercase text-muted">{o.party}</span>
              {o.title}
            </>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={
              type.tone === "dark"
                ? "rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white"
                : "rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-muted"
            }
          >
            {type.text}
          </span>
          {o.provisional && (
            <span className="inline-block rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] text-warn first-letter:uppercase">{t("obligation.beingChecked")}</span>
          )}
          <button
            type="button"
            onClick={onWhy}
            className="inline-block text-[11px] font-medium text-primary underline underline-offset-2 first-letter:uppercase hover:text-primary-dark"
          >
            {t("obligation.why")}
          </button>
        </div>
        {o.pausedMs > 0 && (
          <p className="mt-1 text-xs text-muted">{t("obligation.clockPaused", { h: Math.round(o.pausedMs / 3_600_000) })}</p>
        )}
      </div>
      <div className="shrink-0 whitespace-nowrap text-end">
        {live ? (
          <>
            <Countdown dueAt={o.dueAt} serverNow={now} />
            <p className="text-xs text-muted">
              {t(o.status === "breached" ? "obligation.wasDue" : "obligation.due", { date: formatDateTime(o.dueAt, locale) })}
            </p>
          </>
        ) : (
          <>
            <span className="text-sm text-ok">{t(o.status === "met" ? "obligation.doneOnTime" : "obligation.doneLate")}</span>
            <p className="text-xs text-muted">{formatDateTime(o.dueAt, locale)}</p>
          </>
        )}
      </div>
    </div>
  );
}
