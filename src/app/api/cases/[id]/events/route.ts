import { z } from "zod";
import { appendEvent } from "@/lib/cases/service";
import { ACTORS } from "@/lib/domain/types";
import { handle, type IdParams } from "@/lib/http";

const Body = z.object({ actor: z.enum(ACTORS), event: z.unknown() });

/**
 * Append any event to a case. Returns the new state and the revisions it caused.
 * TODO(stretch): authorise `actor` against the signed-in party (demo trusts the client).
 */
export const POST = handle(async (req: Request, { params }: IdParams) => {
  const { actor, event } = Body.parse(await req.json());
  const result = await appendEvent((await params).id, actor, event);
  return Response.json(result);
});
