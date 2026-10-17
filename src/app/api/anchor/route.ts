import { handle } from "@/lib/http";
import { anchorPending } from "@/lib/solana/anchor";

/** Anchor all new evidence + case-log heads to Solana. Call from the demo panel or a cron (e.g. hourly). */
export const POST = handle(async () => {
  const result = await anchorPending();
  return Response.json(result ?? { message: "nothing new to anchor" });
});
