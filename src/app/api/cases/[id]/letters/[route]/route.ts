import { getCase } from "@/lib/cases/service";
import { polishLetter } from "@/lib/ai/letter-polish";
import { ESCALATION_ROUTES } from "@/lib/domain/types";
import { generateLetter } from "@/lib/escalation/letters";
import { handle } from "@/lib/http";
import { z } from "zod";

/**
 * Draft escalation letter as plain text. The engine writes the facts, dates and
 * citations; Gemini polishes the prose and translates it into the tenant's
 * language. Add `?raw=1` to skip the rewrite. The tenant reviews and sends it.
 */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string; route: string }> }) => {
  const { id, route } = await params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });
  const template = generateLetter(z.enum(ESCALATION_ROUTES).parse(route), {
    state: c.state,
    events: c.events,
    tenantName: c.tenant_name ?? "The tenant",
    landlordName: c.landlord_name,
    address: `${c.address}, ${c.postcode}`,
    title: c.title,
  });
  const raw = new URL(req.url).searchParams.get("raw") === "1";
  const text = raw ? template : await polishLetter(template, c.preferred_language);
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
});
