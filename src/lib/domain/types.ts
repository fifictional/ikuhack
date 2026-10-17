import { z } from "zod";

/**
 * Domain model for Docket. A case is an append-only log of events; everything
 * else (facts, obligations, deadlines) is *derived* from that log by the engine.
 * This file is the contract between the tenant side, the landlord side and the
 * engine — change it deliberately and tell your teammate.
 */

export const ACTORS = ["tenant", "landlord", "contractor", "surveyor", "system"] as const;
export type Actor = (typeof ACTORS)[number];

export const LANDLORD_TYPES = ["social", "private"] as const;
export type LandlordType = (typeof LANDLORD_TYPES)[number];

export const CATEGORIES = [
  "damp_mould",
  "leak",
  "heating_hot_water",
  "electrical",
  "gas",
  "sanitation",
  "structural",
  "security",
  "pest",
  "smoke_co_alarm",
  "appliance",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Ordered least → most severe. Names follow Awaab's Law ("significant", "emergency"). */
export const SEVERITIES = ["routine", "significant", "emergency"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const severityRank = (s: Severity) => SEVERITIES.indexOf(s);

/** Where a fact came from. Reliability per source lives in engine/beliefs.ts. */
export const SOURCE_KINDS = [
  "tenant",
  "landlord",
  "contractor",
  "surveyor",
  "sensor",
  "tenancy_agreement",
  "official_record",
  "ai_vision",
  "ai_text",
  "system",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SourceSchema = z.object({
  kind: z.enum(SOURCE_KINDS),
  /** Identifies the specific source, e.g. contractor name, sensor id, evidence id. */
  ref: z.string().optional(),
  label: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

/** Every fact the engine reasons over, with the type of its value. */
export const FACT_SCHEMAS = {
  "issue.category": z.enum(CATEGORIES),
  "issue.severity": z.enum(SEVERITIES),
  "issue.location": z.string(),
  "issue.summary": z.string(),
  "appliance.suppliedByLandlord": z.boolean(),
  "cause.tenantDamage": z.boolean(),
  "household.vulnerable": z.boolean(),
  "hazard.dampPersistent": z.boolean(),
  /** Is the reported problem actually fixed? Contractor, tenant and Gemini photo checks can disagree. */
  "fix.verified": z.boolean(),
} as const;
export type FactKey = keyof typeof FACT_SCHEMAS;
export type FactValue<K extends FactKey> = z.infer<(typeof FACT_SCHEMAS)[K]>;
export const FACT_KEYS = Object.keys(FACT_SCHEMAS) as [FactKey, ...FactKey[]];

export const ESCALATION_ROUTES = [
  "formal_complaint",
  "housing_ombudsman",
  "council_environmental_health",
  "pre_action_letter",
] as const;
export type EscalationRoute = (typeof ESCALATION_ROUTES)[number];

export const EVIDENCE_KINDS = ["photo", "video", "audio", "document", "transcript", "sensor_export"] as const;

const iso = z.string().min(10);

/** Event bodies. `type` is the discriminator; who/when live on the envelope. */
export const EventBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("REPORTED"),
    description: z.string().min(1),
    channel: z.enum(["voice", "text", "photo", "web"]),
    language: z.string().optional(),
  }),
  z.object({
    type: z.literal("FACT_ASSERTED"),
    key: z.enum(FACT_KEYS),
    value: z.unknown(),
    source: SourceSchema,
    confidence: z.number().min(0).max(1).optional(),
    note: z.string().optional(),
  }),
  z.object({ type: z.literal("FACT_RETRACTED"), assertionId: z.string(), reason: z.string() }),
  z.object({
    type: z.literal("EVIDENCE_ADDED"),
    evidenceId: z.string(),
    sha256: z.string().length(64),
    kind: z.enum(EVIDENCE_KINDS),
    caption: z.string().optional(),
  }),
  z.object({ type: z.literal("ACKNOWLEDGED"), message: z.string().optional() }),
  z.object({ type: z.literal("ACCESS_PROPOSED"), slotStart: iso, slotEnd: iso.optional() }),
  z.object({
    type: z.literal("ACCESS_OUTCOME"),
    proposalId: z.string(),
    outcome: z.enum(["completed", "tenant_no_access", "landlord_no_show"]),
  }),
  z.object({ type: z.literal("INVESTIGATION_COMPLETED"), findings: z.string() }),
  z.object({ type: z.literal("SUMMARY_SENT"), summary: z.string() }),
  z.object({ type: z.literal("MADE_SAFE"), notes: z.string().optional() }),
  z.object({ type: z.literal("WORKS_SCHEDULED"), date: iso }),
  z.object({ type: z.literal("WORKS_STARTED"), notes: z.string().optional() }),
  z.object({ type: z.literal("WORKS_COMPLETED"), notes: z.string().optional() }),
  z.object({ type: z.literal("TENANT_CONFIRMED_FIXED") }),
  z.object({ type: z.literal("TENANT_DISPUTED_FIX"), reason: z.string() }),
  z.object({ type: z.literal("ESCALATED"), route: z.enum(ESCALATION_ROUTES), documentEvidenceId: z.string().optional() }),
  z.object({ type: z.literal("PROTOCOL_RESPONSE"), summary: z.string() }),
  z.object({ type: z.literal("CLOSED"), reason: z.string() }),
]);
export type EventBody = z.infer<typeof EventBodySchema>;
export type EventType = EventBody["type"];

/** A stored event: envelope + body. `at` is ISO-8601. */
export type CaseEvent = EventBody & {
  id: string;
  caseId: string;
  at: string;
  actor: Actor;
};
export type EventOf<T extends EventType> = Extract<CaseEvent, { type: T }>;

/** Validates a body, including the per-key value of FACT_ASSERTED. */
export function parseEventBody(input: unknown): EventBody {
  const body = EventBodySchema.parse(input);
  if (body.type === "FACT_ASSERTED") {
    body.value = FACT_SCHEMAS[body.key].parse(body.value);
  }
  return body;
}

// ---- Derived state (engine output) ------------------------------------------

export interface Belief {
  /** The FACT_ASSERTED event id (or a derived id like `<id>:implied-severity`). */
  id: string;
  key: FactKey;
  value: unknown;
  source: Source;
  confidence: number;
  at: string;
  reliability: number;
  score: number;
  /** Set when the engine inferred this belief from another one. */
  derivedFrom?: string;
  /** Free-text context from the source, e.g. what a photo check saw. */
  note?: string;
}

export interface Conflict {
  key: FactKey;
  candidates: Belief[];
  resolution: "safety_first" | "most_reliable";
  chosenId: string;
}

export interface ResolvedFact {
  key: FactKey;
  value: unknown;
  belief: Belief;
  /** True when the winning belief is AI-inferred or low-confidence: show it, but ask a human. */
  provisional: boolean;
  conflict?: Conflict;
}

export type Facts = Partial<Record<FactKey, ResolvedFact>>;

export interface LegalBasis {
  citation: string;
  /** true = the DUTY comes from law (statute, regulations, protocol or case law); false = a Docket service standard. */
  statutory: boolean;
  /**
   * Who sets the deadline. "law" = a fixed period in the source (e.g. Awaab's Law 10 working days);
   * "target" = Docket's own target for a "reasonable time" duty. Never call a target a legal deadline.
   */
  deadline: "law" | "target";
  url?: string;
  /** Entry in engine/sources.ts. */
  sourceId?: string;
}

export type ObligationStatus = "open" | "met" | "met_late" | "breached";

export interface Obligation {
  /** Stable id so diffs can match obligations across recomputes, e.g. "s11.repair". */
  id: string;
  party: "landlord" | "tenant";
  title: string;
  legalBasis: LegalBasis;
  startAt: string;
  dueAt: string;
  status: ObligationStatus;
  metAt?: string;
  /** Low confidence in a fact it relies on. */
  provisional: boolean;
  /** The fact values this conclusion rests on — used to explain retractions. */
  basis: { key: FactKey; value: unknown; beliefId: string }[];
  pausedMs: number;
  reason: string;
}

export interface CaseState {
  caseId: string;
  computedAt: string;
  openedAt: string;
  /** When the landlord was put on notice (first report). */
  noticeAt: string;
  phase: "triage" | "awaiting_access" | "in_progress" | "fixed_pending_confirmation" | "resolved" | "closed";
  facts: Facts;
  conflicts: Conflict[];
  obligations: Obligation[];
  notes: string[];
  escalationOptions: EscalationRoute[];
}

export type RevisionKind =
  | "obligation_added"
  | "obligation_abandoned"
  | "deadline_changed"
  | "obligation_breached"
  | "obligation_met"
  | "obligation_reopened"
  | "fact_revised"
  | "conflict_detected";

export interface Revision {
  kind: RevisionKind;
  summary: string;
  obligationId?: string;
  factKey?: FactKey;
  detail?: Record<string, unknown>;
}
