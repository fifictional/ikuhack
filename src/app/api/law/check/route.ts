import { connection } from "next/server";
import { handle } from "@/lib/http";
import { persistLawCheck, runLawCheck } from "@/lib/law/check";

/**
 * Runs the law freshness check and stores the result. GET for Vercel cron; POST for the
 * "Check now" button. `connection()` opts it into request-time rendering (the dynamic
 * segment config isn't available under Cache Components).
 */
const check = handle(async () => {
  await connection();
  const results = await runLawCheck();
  const checkedAt = await persistLawCheck(results);
  const summary = { current: 0, amended: 0, manual: 0 };
  for (const r of results) summary[r.status] += 1;
  return Response.json({ checkedAt: checkedAt.toISOString(), summary, results });
});

export const GET = check;
export const POST = check;
