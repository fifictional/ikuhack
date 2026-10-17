import { connection } from "next/server";
import { getCase } from "@/lib/cases/service";
import { getLaw, getNow } from "@/lib/db/settings";
import { project } from "@/lib/engine/project";
import { handle, type IdParams } from "@/lib/http";

/**
 * "What Docket believed at time T": re-projects the case from its event log at
 * an arbitrary time, without writing anything. Defaults to now.
 */
export const GET = handle(async (req: Request, { params }: IdParams) => {
  await connection();
  const { id } = await params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });

  const now = await getNow();
  const openedAt = new Date(c.opened_at);
  const requested = new URL(req.url).searchParams.get("at");
  const parsed = requested ? new Date(requested) : now;
  const at = Number.isNaN(parsed.getTime())
    ? now
    : new Date(Math.min(Math.max(parsed.getTime(), openedAt.getTime()), now.getTime()));

  const law = await getLaw();
  const state = project(id, c.events, { now: at, law, landlordType: c.landlord_type });
  return Response.json({ at: at.toISOString(), state });
});
