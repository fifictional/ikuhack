import { z } from "zod";
import { extractIntake, intakeToFacts } from "@/lib/ai/intake";
import { createCase } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { DEMO } from "@/lib/demo";
import { handle } from "@/lib/http";
import { isAuthorisedToolCall } from "@/lib/voice/elevenlabs";

/**
 * ElevenLabs agent server tool: "report_issue". The agent gathers the details
 * conversationally (in any language) and calls this once it has a description.
 * See docs/VOICE_AGENT.md for the tool schema to paste into the dashboard.
 */
const Params = z.object({
  description: z.string().min(1).describe("Everything the tenant said about the problem, translated to English"),
  original_language: z.string().optional(),
  vulnerable_occupant: z.boolean().optional(),
  property_id: z.string().uuid().optional(),
});

export const POST = handle(async (req: Request) => {
  if (!isAuthorisedToolCall(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const p = Params.parse(await req.json());
  // TODO(person A): resolve the property from the caller's phone number / signed-in tenant.
  const propertyId = p.property_id ?? DEMO.tenantPropertyId;
  const draft = await extractIntake({ text: p.description });
  if (p.vulnerable_occupant) draft.vulnerableOccupantMentioned = true;
  const [property] = await db()`SELECT tenancy FROM properties WHERE id = ${propertyId}`;
  const { caseId, state } = await createCase({
    propertyId,
    title: draft.title,
    report: { description: p.description, channel: "voice", language: p.original_language ?? draft.detectedLanguage },
    facts: intakeToFacts(draft, property?.tenancy?.appliancesSuppliedByLandlord ?? []),
  });
  // Short, speakable answer for the agent to relay.
  const next = state.obligations.filter((o) => o.party === "landlord" && o.status === "open").sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  return Response.json({
    case_id: caseId,
    message: next
      ? `Logged. Your landlord must "${next.title.toLowerCase()}" by ${new Date(next.dueAt).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
      : "Logged. We'll confirm the deadline once the issue has been assessed.",
    follow_up_questions: draft.followUpQuestions,
  });
});
