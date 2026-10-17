import { connection } from "next/server";
import { handle } from "@/lib/http";
import { anchorPending } from "@/lib/solana/anchor";

const anchor = handle(async () => {
  await connection();
  const result = await anchorPending();
  return Response.json(result ?? { message: "nothing new to anchor" });
});

/** Vercel cron invokes GET; the demo panel uses POST. */
export const GET = anchor;
export const POST = anchor;
