import { checkAuthenticity } from "@/lib/evidence/authenticity";
import { handle, type IdParams } from "@/lib/http";

/** Landlord check: is this photo untouched, edited, or AI-made? Cached by file hash; `?refresh=1` re-runs it. */
export const POST = handle(async (req: Request, { params }: IdParams) => {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const report = await checkAuthenticity((await params).id, { refresh });
  if (!report) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(report);
});
