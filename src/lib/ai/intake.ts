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
  category: z.enum(CATEGORIES),
  categoryConfidence: z.number().min(0).max(1),
  location: z.string().nullable().describe("Room or part of the home, if stated"),
  severityClaimedByTenant: z.enum(SEVERITIES).nullable().describe("Only if the tenant's words indicate urgency/danger"),
  photoAssessment: z
    .object({
      severity: z.enum(SEVERITIES),
      confidence: z.number().min(0).max(1),
      observations: z.string(),
    })
    .nullable()
    .describe("Only when photos are provided: what is visibly shown"),
  vulnerableOccupantMentioned: z.boolean().describe("Tenant mentions a baby, child, elderly, disabled or ill household member"),
  applianceName: z.string().nullable().describe("If the problem is a household appliance, which one"),
  followUpQuestions: z.array(z.string()).max(3).describe("Questions that would most change the classification"),
  detectedLanguage: z.string().describe("ISO 639-1 code of the tenant's message"),
});
export type IntakeDraft = z.infer<typeof IntakeSchema>;

const SYSTEM = `You help tenants in England log repair problems with their rented home.
Extract facts from the tenant's message and any photos. Be literal: do not invent details.
Do not give legal conclusions or deadlines. Classify the category from this list: ${CATEGORIES.join(", ")}.
Severity: "emergency" = immediate risk to health/safety (gas smell, no heating in winter with vulnerable occupant,
exposed wiring, major leak, unsecured front door); "significant" = could harm health if left (spreading mould,
persistent leak, no hot water); "routine" = everything else.
Tenants may write in any language; always answer in English but report detectedLanguage.`;

export async function extractIntake(input: { text: string; photos?: InlineFile[] }): Promise<IntakeDraft> {
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
  if (d.severityClaimedByTenant)
    facts.push({ type: "FACT_ASSERTED", key: "issue.severity", value: d.severityClaimedByTenant, source: { kind: "tenant" } });
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
