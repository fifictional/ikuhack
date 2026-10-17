import type { CaseEvent, CaseState, Category, EscalationRoute, Obligation, Severity } from "@/lib/domain/types";

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

export const SEVERITY_PLAIN: Record<Severity, string> = {
  emergency: "Emergency",
  significant: "Urgent",
  routine: "Routine",
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
