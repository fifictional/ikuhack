import { z } from "zod";
import { translateForTenant } from "@/lib/ai/translate";
import { db } from "@/lib/db/client";
import { handle } from "@/lib/http";
import { MAX_TTS_CHARS, speak } from "@/lib/voice/elevenlabs";

/**
 * Read a case update aloud in the tenant's preferred language.
 * Gemini translates (cached), then ElevenLabs speaks it (cached, via guardVoice inside speak()).
 */
export const POST = handle(async (req: Request) => {
  const { caseId, text } = z
    .object({ caseId: z.uuid().optional(), text: z.string().min(1).max(MAX_TTS_CHARS) })
    .parse(await req.json());

  let lang: string | null = null;
  if (caseId) {
    const [row] = await db()<{ preferred_language: string | null }[]>`
      SELECT t.preferred_language FROM cases c JOIN properties p ON p.id = c.property_id
      LEFT JOIN parties t ON t.id = p.tenant_id WHERE c.id = ${caseId}`;
    lang = row?.preferred_language ?? null;
  }
  const spoken = await translateForTenant(text, lang);
  return new Response(Buffer.from(await speak(spoken)), { headers: { "content-type": "audio/mpeg" } });
});
