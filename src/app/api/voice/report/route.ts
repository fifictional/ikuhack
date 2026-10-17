import { handle } from "@/lib/http";
import { ReportParams, reportFromVoice } from "@/lib/voice/report";

/**
 * Called by the browser when the voice agent invokes its `report_issue` client tool.
 * Same-origin, so it works on localhost with no public URL or tool secret.
 */
export const POST = handle(async (req: Request) => {
  return Response.json(await reportFromVoice(ReportParams.parse(await req.json())), { status: 201 });
});
