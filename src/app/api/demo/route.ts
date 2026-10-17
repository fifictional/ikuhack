import { z } from "zod";
import { recomputeAll } from "@/lib/cases/service";
import { db } from "@/lib/db/client";
import { getNow, setClockOffset, setLawOverride } from "@/lib/db/settings";
import { handle } from "@/lib/http";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), hours: z.number() }),
  z.object({ action: z.literal("reset_clock") }),
  z.object({ action: z.literal("commence"), phaseId: z.string() }),
  z.object({ action: z.literal("uncommence"), phaseId: z.string() }),
]);

/**
 * Demo controls: time travel and "a new law comes into force".
 * Both trigger a re-projection of every open case so the adaptive changes show up live.
 * TODO: hide behind a DEMO_MODE env flag before deploying anywhere public.
 */
export const POST = handle(async (req: Request) => {
  const a = Action.parse(await req.json());
  if (a.action === "advance" || a.action === "reset_clock") {
    const [row] = await db()`SELECT value FROM app_settings WHERE key = 'clock_offset_ms'`;
    const current = Number(row?.value ?? 0);
    await setClockOffset(a.action === "reset_clock" ? 0 : current + a.hours * 3_600_000);
  } else if (a.action === "commence") {
    await setLawOverride(a.phaseId, (await getNow()).toISOString().slice(0, 10));
  } else {
    await setLawOverride(a.phaseId, null);
  }
  const recomputed = await recomputeAll();
  return Response.json({ now: (await getNow()).toISOString(), recomputed });
});
