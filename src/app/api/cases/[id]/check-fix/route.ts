import { checkFix } from "@/lib/cases/fix-check";
import { handle, type IdParams } from "@/lib/http";

/** Compare the tenant's "before" photos with the contractor's "after" photos using Gemini. */
export const POST = handle(async (_req: Request, { params }: IdParams) => {
  return Response.json(await checkFix((await params).id));
});
