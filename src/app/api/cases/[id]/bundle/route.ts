import { buildBundle } from "@/lib/escalation/bundle";
import { handle, type IdParams } from "@/lib/http";

export const GET = handle(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const pdf = await buildBundle(id);
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="docket-${id}.pdf"` },
  });
});
