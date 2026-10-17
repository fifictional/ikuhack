import { connection } from "next/server";
import { z } from "zod";
import { IntakeSchema, intakeToFacts } from "@/lib/ai/intake";
import { createCase, listCases } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { DEMO } from "@/lib/demo";
import { handle } from "@/lib/http";

const CreateSchema = z.object({
  propertyId: z.string().uuid().default(DEMO.tenantPropertyId),
  description: z.string().min(1),
  channel: z.enum(["voice", "text", "photo", "web"]),
  draft: IntakeSchema,
});

export const POST = handle(async (req: Request) => {
  const input = CreateSchema.parse(await req.json());
  const [property] = await db()`SELECT tenancy FROM properties WHERE id = ${input.propertyId}`;
  const supplied: string[] = property?.tenancy?.appliancesSuppliedByLandlord ?? [];
  const result = await createCase({
    propertyId: input.propertyId,
    title: input.draft.title,
    report: { description: input.description, channel: input.channel, language: input.draft.detectedLanguage },
    facts: intakeToFacts(input.draft, supplied),
  });
  return Response.json(result, { status: 201 });
});

export const GET = handle(async (req: Request) => {
  await connection();
  const role = new URL(req.url).searchParams.get("role");
  const cases = await listCases(role === "landlord" ? { landlordId: DEMO.landlordId } : { tenantId: DEMO.tenantId });
  return Response.json({ cases });
});
