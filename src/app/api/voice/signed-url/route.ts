import { connection } from "next/server";
import { handle } from "@/lib/http";
import { getAgentSignedUrl } from "@/lib/voice/elevenlabs";

export const GET = handle(async () => {
  await connection();
  return Response.json({ signedUrl: await getAgentSignedUrl() });
});
