"use client";

import { useState } from "react";
import type { Obligation } from "@/lib/domain/types";
import { dutyType, fmtDateTime, plainDuty } from "@/lib/ui/labels";
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
  const type = dutyType(o);
  const live = o.status === "open" || o.status === "breached";

  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {role === "tenant" ? (
            plainDuty(o, landlordName)
          ) : (
            <>
              <span className="mr-2 text-xs uppercase text-muted">{o.party}</span>
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
            <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] text-warn">Being checked</span>
          )}
          <button
            type="button"
            onClick={onWhy}
            className="text-[11px] font-medium text-primary underline underline-offset-2 hover:text-primary-dark"
          >
            Why?
          </button>
        </div>
        {o.pausedMs > 0 && (
          <p className="mt-1 text-xs text-muted">Clock paused {Math.round(o.pausedMs / 3_600_000)}h after a missed appointment</p>
        )}
      </div>
      <div className="shrink-0 whitespace-nowrap text-right">
        {live ? (
          <>
            <Countdown dueAt={o.dueAt} serverNow={now} />
            <p className="text-xs text-muted">
              {o.status === "breached" ? "was due" : "due"} {fmtDateTime(o.dueAt)}
            </p>
          </>
        ) : (
          <>
            <span className="text-sm text-ok">{o.status === "met" ? "Done on time" : "Done late"}</span>
            <p className="text-xs text-muted">{fmtDateTime(o.dueAt)}</p>
          </>
        )}
      </div>
    </div>
  );
}
