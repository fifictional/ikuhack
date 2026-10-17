import { z } from "zod";
import { handle } from "@/lib/http";
import { MAX_TTS_CHARS, speak } from "@/lib/voice/elevenlabs";

/** Read a case update aloud (cached). TODO(person A): translate with Gemini first using the tenant's preferred_language. */
export const POST = handle(async (req: Request) => {
  const { text } = z.object({ text: z.string().min(1).max(MAX_TTS_CHARS) }).parse(await req.json());
  return new Response(Buffer.from(await speak(text)), { headers: { "content-type": "audio/mpeg" } });
});
