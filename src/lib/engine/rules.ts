import type {
  CaseEvent,
  Category,
  EventOf,
  EventType,
  FactKey,
  Facts,
  LandlordType,
  LegalBasis,
  Obligation,
  ObligationStatus,
  Severity,
} from "@/lib/domain/types";
import {
  ACCESS_NOTICE_HOURS,
  AWAAB,
  DOCKET_TARGETS,
  type LawConfig,
  PRE_ACTION_RESPONSE_WORKING_DAYS,
  S11_CATEGORIES,
  S9A_CATEGORIES,
  applicableAwaabPhase,
} from "./law";
import { addCalendarDays, addHours, addWorkingDays } from "./working-days";

/**
 * Deterministic rules: resolved facts + event log + law config → obligations.
 * Each obligation records the facts it rests on (`basis`) so that when a fact
 * changes, the diff can explain exactly why a conclusion was abandoned.
 */

export interface RuleContext {
  now: Date;
  landlordType: LandlordType;
  law: LawConfig;
  facts: Facts;
  events: CaseEvent[];
  noticeAt: Date;
}

export interface RuleOutput {
  obligations: Obligation[];
  notes: string[];
}

interface Interval {
  start: number;
  end: number;
}

const ofType = <T extends EventType>(events: CaseEvent[], type: T) =>
  events.filter((e): e is EventOf<T> => e.type === type);

const firstAt = (events: CaseEvent[], ...types: EventType[]) =>
  events.find((e) => types.includes(e.type))?.at;

/** Latest WORKS_COMPLETED that the tenant has not disputed since. */
export function validCompletionAt(events: CaseEvent[]): string | undefined {
  let completedAt: string | undefined;
  for (const e of events) {
    if (e.type === "WORKS_COMPLETED") completedAt = e.at;
    if (e.type === "TENANT_DISPUTED_FIX") completedAt = undefined;
  }
  return completedAt;
}

/** Periods where the tenant refused/missed access: landlord clocks stop. */
function accessPauses(events: CaseEvent[], now: Date): Interval[] {
  const proposals = ofType(events, "ACCESS_PROPOSED");
  return ofType(events, "ACCESS_OUTCOME")
    .filter((o) => o.outcome === "tenant_no_access")
    .map((o) => {
      const proposal = proposals.find((p) => p.id === o.proposalId);
      const start = new Date(proposal?.slotStart ?? o.at).getTime();
      const next = proposals.find((p) => new Date(p.at).getTime() > new Date(o.at).getTime());
      return { start, end: next ? new Date(next.at).getTime() : now.getTime() };
    });
}

function statusOf(dueAt: Date, metAt: string | undefined, now: Date): ObligationStatus {
  if (metAt) return new Date(metAt).getTime() <= dueAt.getTime() ? "met" : "met_late";
  return now.getTime() > dueAt.getTime() ? "breached" : "open";
}

function basisOf(facts: Facts, keys: FactKey[]): Obligation["basis"] {
  return keys.flatMap((key) => {
    const f = facts[key];
    return f ? [{ key, value: f.value, beliefId: f.belief.id }] : [];
  });
}

function dueBySeverity(start: Date, severity: Severity): Date {
  if (severity === "emergency") return addHours(start, DOCKET_TARGETS.emergencyHours);
  if (severity === "significant") return addWorkingDays(start, DOCKET_TARGETS.significantWorkingDays);
  return addCalendarDays(start, DOCKET_TARGETS.routineCalendarDays);
}

export function deriveObligations(ctx: RuleContext): RuleOutput {
  const { now, facts, events, noticeAt } = ctx;
  const obligations: Obligation[] = [];
  const notes: string[] = [];
  const pauses = accessPauses(events, now);

  const make = (o: {
    id: string;
    party: "landlord" | "tenant";
    title: string;
    legalBasis: LegalBasis;
    start: Date;
    due: Date;
    metAt?: string;
    basisKeys: FactKey[];
    reason: string;
    pausable?: boolean;
  }) => {
    const pausedMs =
      o.pausable && o.party === "landlord"
        ? pauses.filter((p) => p.start >= o.start.getTime()).reduce((sum, p) => sum + (p.end - p.start), 0)
        : 0;
    const due = new Date(o.due.getTime() + pausedMs);
    const basis = basisOf(facts, o.basisKeys);
    obligations.push({
      id: o.id,
      party: o.party,
      title: o.title,
      legalBasis: o.legalBasis,
      startAt: o.start.toISOString(),
      dueAt: due.toISOString(),
      status: statusOf(due, o.metAt, now),
      metAt: o.metAt,
      provisional: o.basisKeys.some((k) => facts[k]?.provisional || facts[k]?.conflict),
      basis,
      pausedMs,
      reason: o.reason,
    });
  };

  // Acknowledgement — a Docket service standard, not law.
  make({
    id: "landlord.acknowledge",
    party: "landlord",
    title: "Acknowledge the report",
    legalBasis: { citation: "Docket service standard", statutory: false },
    start: noticeAt,
    due: addWorkingDays(noticeAt, DOCKET_TARGETS.acknowledgeWorkingDays),
    metAt: firstAt(events, "ACKNOWLEDGED"),
    basisKeys: [],
    reason: "Every report gets a response so the tenant knows it was received.",
  });

  const category = facts["issue.category"]?.value as Category | undefined;
  // Unknown severity is treated as significant until assessed (safety-first).
  const severity = (facts["issue.severity"]?.value as Severity | undefined) ?? "significant";
  if (!facts["issue.severity"]) notes.push("Severity not yet assessed — treated as significant until it is.");
  const vulnerable = facts["household.vulnerable"]?.value === true;

  // Docket safety policy: damp & mould with a vulnerable occupant is handled as an emergency.
  let effectiveSeverity = severity;
  if (vulnerable && category === "damp_mould" && severity === "significant") {
    effectiveSeverity = "emergency";
    notes.push(
      "Vulnerable occupant with damp & mould: handled as an emergency under Docket safety policy (statutory classification still needs assessment).",
    );
  }
  const severityKeys: FactKey[] = ["issue.category", "issue.severity", "household.vulnerable"];

  if (!category) {
    notes.push("Issue not yet categorised — awaiting triage.");
  } else {
    const completion = validCompletionAt(events);
    const tenantDamage = facts["cause.tenantDamage"];
    const tenantCaused = tenantDamage?.value === true && !tenantDamage.conflict;
    if (tenantDamage?.value === true && tenantDamage.conflict) {
      notes.push("Cause of damage is disputed — landlord duties stay open until resolved.");
    }

    if (tenantCaused) {
      make({
        id: "tenant.remedy_damage",
        party: "tenant",
        title: "Put right damage caused by the household",
        legalBasis: { citation: "Duty to use the property in a tenant-like manner (Warren v Keen [1954])", statutory: false },
        start: new Date(tenantDamage.belief.at),
        due: addCalendarDays(new Date(tenantDamage.belief.at), DOCKET_TARGETS.routineCalendarDays),
        metAt: completion,
        basisKeys: ["cause.tenantDamage"],
        reason: "Evidence indicates the damage was caused by the household, so the landlord's repairing duty does not apply.",
      });
    } else if (category === "appliance") {
      const supplied = facts["appliance.suppliedByLandlord"];
      if (supplied?.value === false) {
        notes.push("Appliance is not supplied by the landlord under the tenancy — repair is the tenant's responsibility.");
      } else {
        make({
          id: "contract.appliance_repair",
          party: "landlord",
          title: "Repair landlord-supplied appliance",
          legalBasis: { citation: "Tenancy agreement — landlord-supplied appliances", statutory: false },
          start: noticeAt,
          due: dueBySeverity(noticeAt, effectiveSeverity),
          metAt: completion,
          basisKeys: ["issue.category", "appliance.suppliedByLandlord", ...severityKeys.slice(1)],
          reason: supplied
            ? "The tenancy lists this appliance as supplied by the landlord."
            : "Assumed landlord-supplied until the tenancy agreement is checked.",
          pausable: true,
        });
      }
    } else if (category === "smoke_co_alarm") {
      make({
        id: "alarms.repair",
        party: "landlord",
        title: "Repair or replace the faulty alarm",
        legalBasis: {
          citation: "Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022 — as soon as reasonably practicable",
          statutory: true,
        },
        start: noticeAt,
        due: addHours(noticeAt, DOCKET_TARGETS.emergencyHours),
        metAt: completion,
        basisKeys: ["issue.category"],
        reason: "Landlords must repair or replace alarms reported faulty as soon as reasonably practicable (24h Docket target).",
        pausable: true,
      });
    } else if (S11_CATEGORIES.includes(category) || S9A_CATEGORIES.includes(category)) {
      const s11 = S11_CATEGORIES.includes(category);
      make({
        id: s11 ? "s11.repair" : "s9a.fitness",
        party: "landlord",
        title: s11 ? "Repair (structure, exterior or installations)" : "Make the home fit for human habitation",
        legalBasis: s11
          ? { citation: "Landlord and Tenant Act 1985 s11 — repair within a reasonable time of notice", statutory: true }
          : { citation: "Landlord and Tenant Act 1985 s9A — fitness for human habitation (HHSRS hazards)", statutory: true },
        start: noticeAt,
        due: dueBySeverity(noticeAt, effectiveSeverity),
        metAt: completion,
        basisKeys: severityKeys,
        reason: `The duty is statutory; the deadline is Docket's "reasonable time" target for a ${effectiveSeverity} issue.`,
        pausable: true,
      });
    } else {
      notes.push("No specific repairing duty matched — needs human review.");
    }

    // Awaab's Law: hard statutory clocks for social landlords (and later, private).
    const phase = !tenantCaused
      ? applicableAwaabPhase(ctx.law, ctx.landlordType, category, effectiveSeverity, now)
      : undefined;
    if (phase) {
      const start = new Date(Math.max(noticeAt.getTime(), new Date(phase.commencesAt!).getTime()));
      const legalBasis = { citation: `${AWAAB.citation} (${phase.label})`, statutory: true };
      if (effectiveSeverity === "emergency") {
        make({
          id: "awaab.emergency",
          party: "landlord",
          title: "Investigate and make safe (emergency hazard)",
          legalBasis,
          start,
          due: addHours(start, AWAAB.emergencyHours),
          metAt: firstAt(events, "MADE_SAFE", "WORKS_COMPLETED"),
          basisKeys: severityKeys,
          reason: "Emergency hazards must be investigated and made safe within 24 hours.",
          pausable: true,
        });
      } else {
        const investigatedAt = firstAt(events, "INVESTIGATION_COMPLETED");
        make({
          id: "awaab.investigate",
          party: "landlord",
          title: "Investigate the hazard",
          legalBasis,
          start,
          due: addWorkingDays(start, AWAAB.investigateWorkingDays),
          metAt: investigatedAt,
          basisKeys: severityKeys,
          reason: "Significant hazards must be investigated within 10 working days of the landlord becoming aware.",
          pausable: true,
        });
        if (investigatedAt) {
          const inv = new Date(investigatedAt);
          make({
            id: "awaab.summary",
            party: "landlord",
            title: "Send the tenant a written summary of the investigation",
            legalBasis,
            start: inv,
            due: addWorkingDays(inv, AWAAB.summaryWorkingDays),
            metAt: firstAt(events, "SUMMARY_SENT"),
            basisKeys: severityKeys,
            reason: "A written summary is due within 3 working days of the investigation concluding.",
          });
          make({
            id: "awaab.start_works",
            party: "landlord",
            title: "Begin safety works",
            legalBasis,
            start: inv,
            due: addWorkingDays(inv, AWAAB.startWorksWorkingDays),
            metAt: firstAt(events, "WORKS_STARTED", "WORKS_COMPLETED"),
            basisKeys: severityKeys,
            reason: "Safety works must begin within 5 working days of the investigation.",
            pausable: true,
          });
        }
      }
    }
  }

  // Access: both sides are accountable for appointments.
  const outcomes = ofType(events, "ACCESS_OUTCOME");
  for (const p of ofType(events, "ACCESS_PROPOSED")) {
    const slot = new Date(p.slotStart);
    const noticeHours = (slot.getTime() - new Date(p.at).getTime()) / 3_600_000;
    const outcome = outcomes.find((o) => o.proposalId === p.id);
    const accessBasis = { citation: "Landlord and Tenant Act 1985 s11(6) — access on 24 hours' written notice", statutory: true };
    if (noticeHours >= ACCESS_NOTICE_HOURS || effectiveSeverity === "emergency") {
      make({
        id: `tenant.allow_access:${p.id}`,
        party: "tenant",
        title: `Allow access on ${slot.toLocaleString("en-GB", { timeZone: "Europe/London" })}`,
        legalBasis: accessBasis,
        start: new Date(p.at),
        due: slot,
        metAt: outcome?.outcome === "completed" || outcome?.outcome === "landlord_no_show" ? outcome.at : undefined,
        basisKeys: [],
        reason: "Tenants must allow reasonable access for repairs when given proper notice.",
      });
      if (outcome?.outcome === "tenant_no_access") obligations[obligations.length - 1].status = "breached";
    } else {
      notes.push(`Access proposed with only ${Math.round(noticeHours)}h notice — the tenant may refuse.`);
    }
    make({
      id: `landlord.attend:${p.id}`,
      party: "landlord",
      title: "Attend the booked appointment",
      legalBasis: { citation: "Docket service standard", statutory: false },
      start: new Date(p.at),
      due: slot,
      metAt: outcome?.outcome === "completed" || outcome?.outcome === "tenant_no_access" ? outcome.at : undefined,
      basisKeys: [],
      reason: "Landlords and contractors must turn up to the appointment they booked.",
    });
    if (outcome?.outcome === "landlord_no_show") obligations[obligations.length - 1].status = "breached";
  }

  // Pre-action protocol: once the letter of claim is sent, the landlord has 20 working days.
  const letter = ofType(events, "ESCALATED").find((e) => e.route === "pre_action_letter");
  if (letter) {
    make({
      id: "protocol.landlord_response",
      party: "landlord",
      title: "Respond to the letter of claim",
      legalBasis: { citation: "Pre-Action Protocol for Housing Conditions Claims (England)", statutory: true },
      start: new Date(letter.at),
      due: addWorkingDays(new Date(letter.at), PRE_ACTION_RESPONSE_WORKING_DAYS),
      metAt: firstAt(events, "PROTOCOL_RESPONSE"),
      basisKeys: [],
      reason: "The landlord must respond to a letter of claim within 20 working days.",
    });
  }

  return { obligations, notes };
}
