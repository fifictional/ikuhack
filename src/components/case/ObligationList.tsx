"use client";

import { useState } from "react";
import type { Obligation } from "@/lib/domain/types";
import { deadlineLabel, fmtDateTime, plainDuty } from "@/lib/ui/labels";
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
  const kind = deadlineLabel(o);
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
          {o.provisional && <span className="ml-2 text-xs text-warn">{role === "tenant" ? "being checked" : "provisional"}</span>}
        </p>
        <p className="text-xs text-muted">
          {kind} ·{" "}
          <button type="button" onClick={onWhy} className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark">
            why?
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
        {o.pausedMs > 0 && <p className="text-xs text-muted">Clock paused {Math.round(o.pausedMs / 3_600_000)}h after a missed appointment</p>}
      </div>
      <div className="shrink-0 text-right">
        {o.status === "open" || o.status === "breached" ? (
          <Countdown dueAt={o.dueAt} serverNow={now} />
        ) : (
          <span className="text-sm text-ok">{o.status === "met" ? "Done on time" : "Done late"}</span>
        )}
        <p className="text-xs text-muted">{fmtDateTime(o.dueAt)}</p>
      </div>
    </div>
  );
}
