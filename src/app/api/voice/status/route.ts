import { z } from "zod";
import { handle } from "@/lib/http";
import { caseStatusForVoice } from "@/lib/voice/report";

/** Browser side of the agent's `get_case_status` client tool. */
export const POST = handle(async (req: Request) => {
  const { case_id } = z.object({ case_id: z.string().uuid().optional() }).parse(await req.json().catch(() => ({})));
  return Response.json(await caseStatusForVoice(case_id));
});
