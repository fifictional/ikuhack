import { connection } from "next/server";
import { recomputeAll } from "@/lib/cases/service";
import { getNow } from "@/lib/db/settings";
import { handle } from "@/lib/http";

/**
 * Re-projects every open case at the current (demo-shifted) time so deadline
 * clocks stay fresh between human visits. Hit by the Vercel cron in
 * vercel.json; keeping it out of the page render keeps the dashboard fast.
 */
export const GET = handle(async () => {
  await connection();
  const recomputed = await recomputeAll();
  return Response.json({ now: (await getNow()).toISOString(), recomputed });
});
