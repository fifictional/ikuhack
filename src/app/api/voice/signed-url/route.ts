import { connection } from "next/server";
import { handle } from "@/lib/http";
import { guardVoice } from "@/lib/voice/budget";
import { getAgentSignedUrl } from "@/lib/voice/elevenlabs";

export const GET = handle(async () => {
  await connection();
  await guardVoice("agent");
  // Per-language voices the browser passes back as overrides (Russian has its own; others use the agent's default).
  return Response.json({ signedUrl: await getAgentSignedUrl(), voices: { ru: process.env.ELEVENLABS_VOICE_ID_RU || "CsT9glYAgw8L02hu9od2" } });
});
