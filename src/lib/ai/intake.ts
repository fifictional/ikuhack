import { z } from "zod";
import { CATEGORIES, SEVERITIES, type EventBody } from "@/lib/domain/types";
import { generateStructured, type InlineFile } from "./gemini";

/**
 * Gemini's job is to EXTRACT FACTS, never to decide legal duties or deadlines.
 * Its output becomes FACT_ASSERTED events with an AI or tenant source, which
 * the deterministic engine then reasons over.
 */

export const IntakeSchema = z.object({
  title: z.string().describe("Short case title, max 8 words, in English"),
  summary: z.string().describe("One-paragraph neutral summary of the problem, in English"),
  tenantSummary: z.string().describe("The same summary in the tenant's own language, in plain words, for them to confirm"),
  category: z.enum(CATEGORIES),
  categoryConfidence: z.number().min(0).max(1),
  location: z.string().nullable().describe("Room or part of the home, if stated, in English"),
  assessedSeverity: z.enum(SEVERITIES).describe("Your assessment of the risk, using the severity guide"),
  severityConfidence: z.number().min(0).max(1),
  photoAssessment: z
    .object({
      severity: z.enum(SEVERITIES),
      confidence: z.number().min(0).max(1),
      observations: z.string(),
    })
    .nullable()
    .describe("Only when photos are provided: what is visibly shown"),
  vulnerableOccupantMentioned: z.boolean().describe("Tenant mentions a baby, child, elderly, disabled, pregnant or ill household member"),
  applianceName: z.string().nullable().describe("If the problem is a household appliance, which one (lowercase, e.g. 'dishwasher')"),
  followUpQuestions: z
    .array(z.string())
    .max(3)
    .describe("Up to 3 short questions, in the tenant's language, whose answers would most change category or severity. Empty if clear."),
  detectedLanguage: z.string().describe("ISO 639-1 code of the tenant's message"),
});
export type IntakeDraft = z.infer<typeof IntakeSchema>;

const SYSTEM = `You help tenants in England log repair problems with their rented home.
Extract facts from the tenant's message and any photos. Be literal: do not invent details.
Do not give legal conclusions, rights or deadlines.

Categories: ${CATEGORIES.join(", ")}.
- Windows or doors that don't close/lock → security. Water coming in from outside or from above → leak.
- A household appliance (dishwasher, washing machine, oven, fridge) → appliance, unless the real problem is a leak or electrics.
- Cosmetic or minor fixtures (loose cupboard hinge) → other.

Severity guide (when unsure between two levels, choose the higher):
- emergency: immediate risk to health or safety. Gas smell, sparking or burning electrics, no heating in cold weather
  with a vulnerable person, front door that won't lock, flooding, no working toilet in the home, structural collapse risk.
- significant: will harm health or the home if left. Spreading mould, any recurring leak or water through ceilings,
  no hot water, faulty smoke or CO alarm, pests, broken windows letting in cold or rain.
- routine: inconvenience without health risk. Appliance faults, minor fixtures, cosmetic damage.

The tenant may write in any language. Write title and summary in English; write tenantSummary and followUpQuestions
in the tenant's language. Report detectedLanguage.`;

export async function extractIntake(input: { text: string; photos?: InlineFile[] }): Promise<IntakeDraft & { _model: string }> {
  return generateStructured({
    schema: IntakeSchema,
    system: SYSTEM,
    prompt: `Tenant's report:\n"""${input.text}"""\n${input.photos?.length ? `${input.photos.length} photo(s) attached.` : "No photos."}`,
    files: input.photos,
  });
}

/** Turn an intake draft into fact events, each tagged with where it came from. */
export function intakeToFacts(d: IntakeDraft, appliancesSuppliedByLandlord: string[] = []): EventBody[] {
  const facts: EventBody[] = [
    { type: "FACT_ASSERTED", key: "issue.summary", value: d.summary, source: { kind: "ai_text" } },
    {
      type: "FACT_ASSERTED",
      key: "issue.category",
      value: d.category,
      source: { kind: "ai_text", label: "Gemini triage" },
      confidence: d.categoryConfidence,
    },
  ];
  if (d.location) facts.push({ type: "FACT_ASSERTED", key: "issue.location", value: d.location, source: { kind: "tenant" } });
  facts.push({
    type: "FACT_ASSERTED",
    key: "issue.severity",
    value: d.assessedSeverity,
    source: { kind: "ai_text", label: "Gemini triage" },
    confidence: d.severityConfidence,
  });
  if (d.photoAssessment)
    facts.push({
      type: "FACT_ASSERTED",
      key: "issue.severity",
      value: d.photoAssessment.severity,
      source: { kind: "ai_vision", label: "Gemini photo assessment" },
      confidence: d.photoAssessment.confidence,
      note: d.photoAssessment.observations,
    });
  if (d.vulnerableOccupantMentioned)
    facts.push({ type: "FACT_ASSERTED", key: "household.vulnerable", value: true, source: { kind: "tenant" } });
  if (d.category === "appliance" && d.applianceName) {
    const supplied = appliancesSuppliedByLandlord.some((a) => d.applianceName!.toLowerCase().includes(a.toLowerCase()));
    facts.push({
      type: "FACT_ASSERTED",
      key: "appliance.suppliedByLandlord",
      value: supplied,
      source: { kind: "tenancy_agreement", label: "Tenancy agreement inventory" },
    });
  }
  return facts;
}

// TODO(person A): parseTenancyAgreement(pdf: InlineFile) → { appliancesSuppliedByLandlord, start, repairClauses }
// using generateStructured; store the result in properties.tenancy and the PDF as evidence.
