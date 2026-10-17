import {
  type Belief,
  type CaseEvent,
  type Conflict,
  type EventOf,
  type FactKey,
  type Facts,
  type ResolvedFact,
  type Severity,
  type SourceKind,
  FACT_KEYS,
  severityRank,
} from "@/lib/domain/types";

/**
 * Belief resolution: turns raw FACT_ASSERTED events into one resolved value per
 * fact, keeping provenance and surfacing conflicts instead of averaging them away.
 */

const BASE_RELIABILITY: Record<SourceKind, number> = {
  official_record: 0.95,
  tenancy_agreement: 0.9,
  surveyor: 0.85,
  contractor: 0.8,
  sensor: 0.8,
  system: 0.7,
  tenant: 0.6,
  landlord: 0.6,
  ai_vision: 0.5,
  ai_text: 0.45,
};

/** Per-fact adjustments: who is actually in a position to know. */
const RELIABILITY_OVERRIDES: Partial<Record<FactKey, Partial<Record<SourceKind, number>>>> = {
  "household.vulnerable": { tenant: 0.9 },
  "issue.location": { tenant: 0.85 },
  "appliance.suppliedByLandlord": { tenancy_agreement: 0.95, tenant: 0.5, landlord: 0.55 },
  // Both parties have an interest in who caused the damage.
  "cause.tenantDamage": { contractor: 0.7, landlord: 0.4, tenant: 0.4 },
};

/** Two beliefs this close in score with different values are a genuine conflict. */
export const CONFLICT_MARGIN = 0.2;
const MIN_CONFLICT_SCORE = 0.35;
const PROVISIONAL_SOURCES: SourceKind[] = ["ai_vision", "ai_text"];

export function reliability(kind: SourceKind, key: FactKey): number {
  return RELIABILITY_OVERRIDES[key]?.[kind] ?? BASE_RELIABILITY[kind];
}

/** Live beliefs: not retracted, and only the latest assertion per (key, source). */
export function collectBeliefs(events: CaseEvent[]): Belief[] {
  const retracted = new Set(
    events.filter((e): e is EventOf<"FACT_RETRACTED"> => e.type === "FACT_RETRACTED").map((e) => e.assertionId),
  );
  const latest = new Map<string, Belief>();
  for (const e of events) {
    if (e.type !== "FACT_ASSERTED" || retracted.has(e.id)) continue;
    const confidence = e.confidence ?? 1;
    const rel = reliability(e.source.kind, e.key);
    const belief: Belief = {
      id: e.id,
      key: e.key,
      value: e.value,
      source: e.source,
      confidence,
      at: e.at,
      reliability: rel,
      score: rel * confidence,
    };
    latest.set(`${e.key}|${e.source.kind}|${e.source.ref ?? ""}`, belief);
  }
  const beliefs = [...latest.values()];

  // Derived: persistent damp from sensors implies at least a "significant" hazard.
  for (const b of beliefs) {
    if (b.key === "hazard.dampPersistent" && b.value === true) {
      beliefs.push({ ...b, id: `${b.id}:implied-severity`, key: "issue.severity", value: "significant", derivedFrom: b.id });
    }
  }
  return beliefs;
}

export function resolveFact(beliefs: Belief[], key: FactKey): ResolvedFact | undefined {
  const candidates = beliefs
    .filter((b) => b.key === key)
    .sort((a, b) => b.score - a.score || b.at.localeCompare(a.at));
  if (candidates.length === 0) return undefined;

  const top = candidates[0];
  const rivals = candidates.filter(
    (c) => c.value !== top.value && c.score >= MIN_CONFLICT_SCORE && top.score - c.score <= CONFLICT_MARGIN,
  );

  let chosen = top;
  let conflict: Conflict | undefined;
  if (rivals.length > 0) {
    if (key === "issue.severity") {
      // Safety-first: when credible sources disagree on severity, act on the most severe.
      chosen = [top, ...rivals].reduce((a, b) =>
        severityRank(b.value as Severity) > severityRank(a.value as Severity) ? b : a,
      );
      conflict = { key, candidates: [top, ...rivals], resolution: "safety_first", chosenId: chosen.id };
    } else {
      conflict = { key, candidates: [top, ...rivals], resolution: "most_reliable", chosenId: top.id };
    }
  }

  return {
    key,
    value: chosen.value,
    belief: chosen,
    provisional: PROVISIONAL_SOURCES.includes(chosen.source.kind) || chosen.score < 0.5,
    conflict,
  };
}

export function resolveFacts(events: CaseEvent[]): Facts {
  const beliefs = collectBeliefs(events);
  const facts: Facts = {};
  for (const key of FACT_KEYS) {
    const r = resolveFact(beliefs, key);
    if (r) facts[key] = r;
  }
  return facts;
}
