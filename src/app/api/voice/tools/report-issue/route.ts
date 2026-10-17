import { handle } from "@/lib/http";
import { isAuthorisedToolCall } from "@/lib/voice/elevenlabs";
import { ReportParams, reportFromVoice } from "@/lib/voice/report";

/**
 * Webhook version of `report_issue`, for a phone line (Twilio) where there's no browser
 * to run client tools. Needs a public URL and the x-docket-tool-secret header.
 */
export const POST = handle(async (req: Request) => {
  if (!isAuthorisedToolCall(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  return Response.json(await reportFromVoice(ReportParams.parse(await req.json())));
});
