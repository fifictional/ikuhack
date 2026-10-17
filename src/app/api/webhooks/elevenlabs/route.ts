import { handle } from "@/lib/http";
import { verifyWebhook } from "@/lib/voice/elevenlabs";

/**
 * Post-call webhook from ElevenLabs (configure in the dashboard → Agents → Webhooks).
 * Verifies the signature; the transcript should be stored as evidence on the case
 * the call created, so the call itself becomes part of the tamper-evident record.
 */
export const POST = handle(async (req: Request) => {
  const raw = await req.text();
  const signature = req.headers.get("elevenlabs-signature") ?? "";
  const event = await verifyWebhook(raw, signature);
  // TODO(person A): if event.type === "post_call_transcription", find the case_id the
  // report_issue tool returned in this conversation (event.data.transcript tool results /
  // dynamic variables), then addEvidence({ kind: "transcript", mime: "text/plain", bytes: transcript }).
  console.log("elevenlabs webhook", event?.type);
  return Response.json({ ok: true });
});
