import { getCase } from "@/lib/cases/service";
import { ESCALATION_ROUTES } from "@/lib/domain/types";
import { generateLetter } from "@/lib/escalation/letters";
import { handle } from "@/lib/http";
import { z } from "zod";

/** Draft escalation letter as plain text. The tenant reviews and sends it; then the UI logs ESCALATED. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string; route: string }> }) => {
  const { id, route } = await params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });
  const text = generateLetter(z.enum(ESCALATION_ROUTES).parse(route), {
    state: c.state,
    events: c.events,
    tenantName: c.tenant_name ?? "The tenant",
    landlordName: c.landlord_name,
    address: `${c.address}, ${c.postcode}`,
    title: c.title,
  });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
});
