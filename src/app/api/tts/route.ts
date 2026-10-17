import { z } from "zod";
import { handle } from "@/lib/http";
import { speak } from "@/lib/voice/elevenlabs";

/** Read a case update aloud. TODO(person A): translate with Gemini first using the tenant's preferred_language. */
export const POST = handle(async (req: Request) => {
  const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(await req.json());
  return new Response(await speak(text), { headers: { "content-type": "audio/mpeg" } });
});
