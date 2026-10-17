import type { CaseState, FactKey, Obligation, Revision } from "@/lib/domain/types";

const FACT_LABEL: Record<FactKey, string> = {
  "issue.category": "the type of problem",
  "issue.severity": "how serious it is",
  "issue.location": "where it is",
  "issue.summary": "the description",
  "appliance.suppliedByLandlord": "whether the landlord supplied the appliance",
  "cause.tenantDamage": "whether the household caused the damage",
  "household.vulnerable": "someone vulnerable at home",
  "hazard.dampPersistent": "persistent damp (sensor)",
  "fix.verified": "whether the repair worked",
};

const fmt = (v: unknown) =>
  v === null || v === undefined ? "unknown" : v === true ? "yes" : v === false ? "no" : typeof v === "string" ? v.replaceAll("_", " ") : JSON.stringify(v);
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Explains what changed between two projections — this is the "agent changed
 * its mind, and here's why" feed shown to both parties.
 */
export function diff(prev: CaseState | null, next: CaseState): Revision[] {
  const out: Revision[] = [];
  const prevObs = new Map(prev?.obligations.map((o) => [o.id, o]) ?? []);
  const nextObs = new Map(next.obligations.map((o) => [o.id, o]));

  // Facts
  for (const [key, f] of Object.entries(next.facts)) {
    const before = prev?.facts[key as keyof typeof next.facts];
    if (f && before && before.value !== f.value) {
      out.push({
        kind: "fact_revised",
        factKey: f.key,
        summary: `Docket updated ${FACT_LABEL[f.key]}: "${fmt(before.value)}" → "${fmt(f.value)}" (source: ${f.belief.source.label ?? f.belief.source.kind}).`,
        detail: { from: before.value, to: f.value, beliefId: f.belief.id },
      });
    }
  }

  // Conflicts
  const prevConflicts = new Set(prev?.conflicts.map((c) => c.key) ?? []);
  for (const c of next.conflicts) {
    if (!prevConflicts.has(c.key)) {
      out.push({
        kind: "conflict_detected",
        factKey: c.key,
        summary: `Sources disagree on ${FACT_LABEL[c.key]}: ${c.candidates
          .map((b) => `${b.source.label ?? b.source.kind} says "${fmt(b.value)}"`)
          .join(" vs ")}. ${c.resolution === "safety_first" ? "Docket takes the safer view until it's resolved." : "Docket goes with the most reliable source."}`,
        detail: { candidates: c.candidates.map((b) => b.id), chosenId: c.chosenId },
      });
    }
  }

  // Obligations abandoned
  for (const [id, o] of prevObs) {
    if (!nextObs.has(id)) {
      out.push({ kind: "obligation_abandoned", obligationId: id, summary: `Dropped "${o.title}": ${whyAbandoned(o, next)}` });
    }
  }

  // Obligations added / changed
  for (const [id, o] of nextObs) {
    const before = prevObs.get(id);
    if (!before) {
      out.push({
        kind: "obligation_added",
        obligationId: id,
        summary: `New ${o.legalBasis.deadline === "law" ? "legal deadline" : o.legalBasis.statutory ? "legal duty" : "target"} for ${o.party}: "${o.title}" by ${when(o.dueAt)}.`,
      });
      continue;
    }
    if (before.dueAt !== o.dueAt) {
      out.push({
        kind: "deadline_changed",
        obligationId: id,
        summary: `Deadline for "${o.title}" moved from ${when(before.dueAt)} to ${when(o.dueAt)}.`,
        detail: { from: before.dueAt, to: o.dueAt },
      });
    }
    if (before.status !== o.status) {
      if (o.status === "breached") {
        out.push({ kind: "obligation_breached", obligationId: id, summary: `${o.party} missed "${o.title}" (due ${when(o.dueAt)}).` });
      } else if ((before.status === "met" || before.status === "met_late") && o.status === "open") {
        out.push({ kind: "obligation_reopened", obligationId: id, summary: `Reopened "${o.title}": it was marked done, but the evidence says it isn't.` });
      } else if (o.status === "met" || o.status === "met_late") {
        out.push({ kind: "obligation_met", obligationId: id, summary: `"${o.title}" met${o.status === "met_late" ? " late" : ""}.` });
      }
    }
  }
  return out;
}

function whyAbandoned(o: Obligation, next: CaseState): string {
  const changed = o.basis.filter((b) => (next.facts[b.key]?.value ?? null) !== b.value);
  if (changed.length === 0) return "the circumstances it depended on no longer apply.";
  return changed
    .map((b) => {
      const now = next.facts[b.key];
      return now
        ? `${FACT_LABEL[b.key]} is now "${fmt(now.value)}" (was "${fmt(b.value)}", per ${now.belief.source.label ?? now.belief.source.kind})`
        : `${FACT_LABEL[b.key]} ("${fmt(b.value)}") was retracted`;
    })
    .join("; ");
}
