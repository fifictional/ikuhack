import { z } from "zod";
import { handle } from "@/lib/http";
import { isAuthorisedToolCall } from "@/lib/voice/elevenlabs";
import { caseStatusForVoice } from "@/lib/voice/report";

/** Webhook version of `get_case_status`, for a phone line. */
export const POST = handle(async (req: Request) => {
  if (!isAuthorisedToolCall(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const { case_id } = z.object({ case_id: z.string().uuid().optional() }).parse(await req.json().catch(() => ({})));
  return Response.json(await caseStatusForVoice(case_id));
});
