import { z } from "zod";
import { getCase, listCases } from "@/lib/cases/service";
import { DEMO } from "@/lib/demo";
import { handle } from "@/lib/http";
import { isAuthorisedToolCall } from "@/lib/voice/elevenlabs";

/** ElevenLabs agent server tool: "get_case_status" — lets a tenant ask "what's happening with my repair?" */
export const POST = handle(async (req: Request) => {
  if (!isAuthorisedToolCall(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const { case_id } = z.object({ case_id: z.string().uuid().optional() }).parse(await req.json().catch(() => ({})));
  const id = case_id ?? (await listCases({ tenantId: DEMO.tenantId }))[0]?.id;
  if (!id) return Response.json({ message: "You don't have any open repairs." });
  const c = await getCase(id);
  if (!c) return Response.json({ message: "I couldn't find that repair." });
  return Response.json({
    title: c.title,
    phase: c.state.phase,
    duties: c.state.obligations.map((o) => ({ who: o.party, what: o.title, due: o.dueAt, status: o.status, statutory: o.legalBasis.statutory })),
    latest_changes: c.revisions.slice(0, 3).map((r) => r.summary),
  });
});
