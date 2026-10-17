import { connection } from "next/server";
import { handle } from "@/lib/http";
import { guardVoice } from "@/lib/voice/budget";
import { getAgentSignedUrl } from "@/lib/voice/elevenlabs";

export const GET = handle(async () => {
  await connection();
  await guardVoice("agent");
  return Response.json({ signedUrl: await getAgentSignedUrl() });
});
