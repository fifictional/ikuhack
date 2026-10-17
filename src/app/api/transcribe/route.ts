import { handle } from "@/lib/http";
import { transcribe } from "@/lib/voice/elevenlabs";

/** Voice note → text with ElevenLabs Scribe (auto-detects language). */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return Response.json({ error: "audio required" }, { status: 400 });
  return Response.json(await transcribe(audio));
});
