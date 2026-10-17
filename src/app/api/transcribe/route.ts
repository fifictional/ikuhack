import { handle } from "@/lib/http";
import { MAX_VOICE_NOTE_BYTES, transcribe } from "@/lib/voice/elevenlabs";

/** Voice note → text with ElevenLabs Scribe (auto-detects language). */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return Response.json({ error: "audio required" }, { status: 400 });
  if (audio.size > MAX_VOICE_NOTE_BYTES) return Response.json({ error: "Voice note too long — keep it under 2 minutes." }, { status: 413 });
  return Response.json(await transcribe(audio));
});
