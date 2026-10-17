import { getCase } from "@/lib/cases/service";
import { handle, type IdParams } from "@/lib/http";

export const GET = handle(async (_req: Request, { params }: IdParams) => {
  const c = await getCase((await params).id);
  return c ? Response.json(c) : Response.json({ error: "not_found" }, { status: 404 });
});
