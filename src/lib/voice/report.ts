import { z } from "zod";
import { extractIntake, intakeToFacts } from "@/lib/ai/intake";
import { createCase, getCase, listCases } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { DEMO } from "@/lib/demo";
import { plainDuty } from "@/lib/ui/labels";

/**
 * What the voice agent's tools actually do. Shared by the browser client tools
 * (/api/voice/report, /api/voice/status) and the webhook tools for a future phone line
 * (/api/voice/tools/*), so both paths behave identically.
 */

export const ReportParams = z.object({
  description: z.string().min(1),
  original_language: z.string().optional(),
  vulnerable_occupant: z.boolean().optional(),
  property_id: z.string().uuid().optional(),
});

const spokenDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

export async function reportFromVoice(input: z.infer<typeof ReportParams>) {
  // TODO(person A): resolve the property from the signed-in tenant / caller's phone number.
  const propertyId = input.property_id ?? DEMO.tenantPropertyId;
  const draft = await extractIntake({ text: input.description });
  if (input.vulnerable_occupant) draft.vulnerableOccupantMentioned = true;
  const [property] = await db()`SELECT tenancy FROM properties WHERE id = ${propertyId}`;
  const { caseId, state } = await createCase({
    propertyId,
    title: draft.title,
    report: { description: input.description, channel: "voice", language: input.original_language ?? draft.detectedLanguage },
    facts: intakeToFacts(draft, property?.tenancy?.appliancesSuppliedByLandlord ?? []),
  });

  const landlord = (await getCase(caseId))?.landlord_name ?? "Your landlord";
  const next = state.obligations
    .filter((o) => o.party === "landlord" && o.status === "open" && o.legalBasis.statutory)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  return {
    case_id: caseId,
    // Short and speakable: the agent reads this back (translated into the caller's language).
    message: next
      ? `Logged. ${plainDuty(next, landlord)} by ${spokenDate(next.dueAt)}. Docket will track it and tell you if they miss it.`
      : "Logged. We'll confirm the deadline once the problem has been assessed.",
    follow_up_questions: draft.followUpQuestions,
  };
}

export async function caseStatusForVoice(caseId?: string) {
  const id = caseId ?? (await listCases({ tenantId: DEMO.tenantId }))[0]?.id;
  if (!id) return { message: "You don't have any repairs logged yet." };
  const c = await getCase(id);
  if (!c) return { message: "I couldn't find that repair." };
  const open = c.state.obligations
    .filter((o) => o.status === "open" || o.status === "breached")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return {
    case_id: id,
    title: c.title,
    message: open.length
      ? open
          .slice(0, 3)
          .map((o) => `${plainDuty(o, c.landlord_name)} by ${spokenDate(o.dueAt)}${o.status === "breached" ? " — this deadline has been missed" : ""}.`)
          .join(" ")
      : "Nothing is due on this repair right now.",
    latest_changes: c.revisions.slice(0, 3).map((r) => r.summary),
  };
}
