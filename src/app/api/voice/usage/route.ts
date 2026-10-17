import { connection } from "next/server";
import { handle } from "@/lib/http";
import { voiceUsage } from "@/lib/voice/budget";

/** Credit + session usage for the demo panel. */
export const GET = handle(async () => {
  await connection();
  return Response.json(await voiceUsage());
});
