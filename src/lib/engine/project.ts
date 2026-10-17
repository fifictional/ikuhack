import type { CaseEvent, CaseState, EscalationRoute, LandlordType } from "@/lib/domain/types";
import { resolveFacts } from "./beliefs";
import { type LawConfig } from "./law";
import { deriveObligations, effectiveCompletionAt } from "./rules";

export interface ProjectOptions {
  now: Date;
  landlordType: LandlordType;
  law: LawConfig;
}

/**
 * The engine entry point. Pure and deterministic: same events + same `now` +
 * same law → same state. Re-run it whenever anything changes; never patch state.
 */
export function project(caseId: string, events: CaseEvent[], opts: ProjectOptions): CaseState {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  // Only events that had happened by `now` count (supports time travel in the demo).
  const visible = sorted.filter((e) => new Date(e.at).getTime() <= opts.now.getTime());

  const reported = visible.find((e) => e.type === "REPORTED");
  const openedAt = visible[0]?.at ?? opts.now.toISOString();
  const noticeAt = new Date(reported?.at ?? openedAt);

  const facts = resolveFacts(visible);
  const { obligations, notes } = deriveObligations({
    now: opts.now,
    landlordType: opts.landlordType,
    law: opts.law,
    facts,
    events: visible,
    noticeAt,
  });

  const conflicts = Object.values(facts).flatMap((f) => (f?.conflict ? [f.conflict] : []));

  const has = (t: CaseEvent["type"]) => visible.some((e) => e.type === t);
  const completed = effectiveCompletionAt(visible, facts);
  const phase: CaseState["phase"] = has("CLOSED")
    ? "closed"
    : completed && has("TENANT_CONFIRMED_FIXED")
      ? "resolved"
      : completed
        ? "fixed_pending_confirmation"
        : has("ACCESS_PROPOSED") && !has("INVESTIGATION_COMPLETED") && !has("WORKS_STARTED")
          ? "awaiting_access"
          : has("ACKNOWLEDGED")
            ? "in_progress"
            : "triage";

  const landlordBreach = obligations.some((o) => o.party === "landlord" && o.status === "breached" && o.legalBasis.statutory);
  const escalationOptions: EscalationRoute[] = !landlordBreach
    ? []
    : opts.landlordType === "social"
      ? ["formal_complaint", "housing_ombudsman", "pre_action_letter"]
      : ["council_environmental_health", "pre_action_letter"];

  return {
    caseId,
    computedAt: opts.now.toISOString(),
    openedAt,
    noticeAt: noticeAt.toISOString(),
    phase,
    facts,
    conflicts,
    obligations,
    notes,
    escalationOptions,
  };
}
