import type { CaseEvent, CaseState, Category, EscalationRoute, FactKey, Obligation, Severity } from "@/lib/domain/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  damp_mould: "Damp & mould",
  leak: "Leak / water",
  heating_hot_water: "Heating or hot water",
  electrical: "Electrics",
  gas: "Gas",
  sanitation: "Toilet, drains or sanitation",
  structural: "Structure (walls, roof, floors)",
  security: "Doors, windows or locks",
  pest: "Pests",
  smoke_co_alarm: "Smoke / CO alarm",
  appliance: "Appliance",
  other: "Other",
};

export const PHASE_LABEL: Record<CaseState["phase"], string> = {
  triage: "Being assessed",
  awaiting_access: "Awaiting access",
  in_progress: "In progress",
  fixed_pending_confirmation: "Fixed — awaiting tenant confirmation",
  resolved: "Resolved",
  closed: "Closed",
};

export const ESCALATION_LABEL: Record<EscalationRoute, string> = {
  formal_complaint: "Formal complaint to landlord",
  housing_ombudsman: "Refer to the Housing Ombudsman",
  council_environmental_health: "Report to council environmental health",
  pre_action_letter: "Letter of claim (pre-action protocol)",
};

export function describeEvent(e: CaseEvent): string {
  switch (e.type) {
    case "REPORTED": return `Reported via ${e.channel}: “${e.description}”`;
    case "FACT_ASSERTED": return `${e.source.label ?? e.source.kind} noted ${e.key} = ${String(e.value)}${e.note ? ` (${e.note})` : ""}`;
    case "FACT_RETRACTED": return `Retracted a fact: ${e.reason}`;
    case "EVIDENCE_ADDED": return `Evidence added (${e.kind})${e.caption ? `: ${e.caption}` : ""}`;
    case "ACKNOWLEDGED": return "Landlord acknowledged the report";
    case "ACCESS_PROPOSED": return `Access proposed for ${fmtDateTime(e.slotStart)}`;
    case "ACCESS_OUTCOME": return `Appointment outcome: ${e.outcome.replaceAll("_", " ")}`;
    case "INVESTIGATION_COMPLETED": return `Investigation completed: ${e.findings}`;
    case "SUMMARY_SENT": return "Written summary sent to tenant";
    case "MADE_SAFE": return "Hazard made safe";
    case "WORKS_SCHEDULED": return `Works scheduled for ${fmtDateTime(e.date)}`;
    case "WORKS_STARTED": return "Works started";
    case "WORKS_COMPLETED": return "Works marked complete";
    case "TENANT_CONFIRMED_FIXED": return "Tenant confirmed it's fixed";
    case "TENANT_DISPUTED_FIX": return `Tenant says it's not fixed: ${e.reason}`;
    case "ESCALATED": return `Escalated: ${ESCALATION_LABEL[e.route]}`;
    case "PROTOCOL_RESPONSE": return "Landlord responded to letter of claim";
    case "CLOSED": return `Closed: ${e.reason}`;
  }
}

/** What each duty means in plain words, keyed by obligation id (before any ":<eventId>" suffix). */
const PLAIN_DUTY: Record<string, string> = {
  "landlord.acknowledge": "confirm they've received your report",
  "s11.repair": "fix it",
  "s9a.fitness": "fix the cause so your home is fit to live in",
  "contract.appliance_repair": "repair the appliance they supplied",
  "alarms.repair": "repair or replace the alarm",
  "awaab.emergency": "check the problem and make it safe",
  "awaab.investigate": "inspect the problem",
  "awaab.summary": "send you a written summary of what they found",
  "awaab.start_works": "start the repair work",
  "landlord.attend": "turn up to the appointment",
  "protocol.landlord_response": "reply to your letter of claim",
  "tenant.allow_access": "let them in for the appointment",
  "tenant.remedy_damage": "put right the damage",
};

/** "Riverside Homes must fix it" / "You need to let them in" — the tenant's view of a duty. */
export function plainDuty(o: Obligation, landlordName: string): string {
  const phrase = PLAIN_DUTY[o.id.split(":")[0]] ?? o.title.toLowerCase();
  return o.party === "tenant" ? `You need to ${phrase}` : `${landlordName} must ${phrase}`;
}

/** Plain-English names for facts, for conflict and history displays. */
export const FACT_PLAIN: Record<FactKey, string> = {
  "issue.category": "what the problem is",
  "issue.severity": "how serious it is",
  "issue.location": "where it is",
  "issue.summary": "the description",
  "appliance.suppliedByLandlord": "whether the landlord supplied the appliance",
  "cause.tenantDamage": "whether the household caused the damage",
  "household.vulnerable": "whether someone vulnerable lives there",
  "hazard.dampPersistent": "whether the damp is persistent",
  "fix.verified": "whether the repair worked",
};

export const factValuePlain = (v: unknown) =>
  v === true ? "yes" : v === false ? "no" : typeof v === "string" ? v.replaceAll("_", " ") : String(v);

const SOURCE_PLAIN: Record<string, string> = {
  tenant: "Tenant", landlord: "Landlord", contractor: "Contractor", surveyor: "Surveyor", sensor: "Sensor",
  tenancy_agreement: "Tenancy agreement", official_record: "Official record", ai_vision: "Gemini (photos)", ai_text: "Gemini", system: "Docket",
};
export const sourcePlain = (s: { kind: string; label?: string }) => s.label ?? SOURCE_PLAIN[s.kind] ?? s.kind;

/** How to describe a duty's deadline. Only "law" deadlines may be called legal deadlines. */
export function deadlineLabel(o: Obligation): string {
  if (!o.legalBasis.statutory) return "Docket target (not a legal deadline)";
  return o.legalBasis.deadline === "law" ? "Legal deadline" : "Legal duty · Docket's target time (the law says 'a reasonable time')";
}

export const SEVERITY_PLAIN: Record<Severity, string> = {
  emergency: "Emergency",
  significant: "Urgent",
  routine: "Routine",
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "Sat 17 Oct" — short day label for timeline ends. */
export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });

/** "Sunday 25 October" — day-group heading for the change feed. */
export const fmtDayLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });

/** "20:10" — time only, for the change feed. */
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

/**
 * Short pill describing where a duty's clock comes from. Dark = the law sets it;
 * light = Docket's own service target.
 */
export function dutyType(o: Obligation): { text: string; tone: "dark" | "light" } {
  if (!o.legalBasis.statutory) return { text: "Docket target", tone: "light" };
  if (o.legalBasis.deadline === "law") {
    return {
      text: o.legalBasis.citation.includes("Awaab") ? "Legal deadline · Awaab's Law" : "Legal deadline",
      tone: "dark",
    };
  }
  return { text: "Legal duty · reasonable time", tone: "dark" };
}
