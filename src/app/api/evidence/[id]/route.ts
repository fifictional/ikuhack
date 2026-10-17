import { getEvidence } from "@/lib/evidence/store";
import { handle, type IdParams } from "@/lib/http";

// TODO(stretch): check the requester is a party to the case before serving the file.
export const GET = handle(async (_req: Request, { params }: IdParams) => {
  const e = await getEvidence((await params).id);
  if (!e) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(Buffer.from(e.bytes), { headers: { "content-type": e.mime, "x-sha256": e.sha256 } });
});
