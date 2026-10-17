import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "@/lib/env";

/**
 * ElevenLabs usage in Docket:
 *  1. Agents — the multilingual voice intake line (browser widget; Twilio phone number is a stretch goal).
 *     The agent calls our server tools under /api/voice/tools/* to create and update cases.
 *  2. Scribe — transcribe voice notes the tenant records instead of typing.
 *  3. TTS — read case updates aloud in the tenant's language.
 * Configure the agent in the ElevenLabs dashboard using docs/VOICE_AGENT.md.
 */

let client: ElevenLabsClient | undefined;
export function elevenlabs(): ElevenLabsClient {
  client ??= new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
  return client;
}

/** Signed URL so the browser can talk to a private agent without seeing our API key. */
export async function getAgentSignedUrl(): Promise<string> {
  const res = await elevenlabs().conversationalAi.conversations.getSignedUrl({ agentId: env.ELEVENLABS_AGENT_ID });
  return res.signedUrl;
}

export async function transcribe(file: Blob): Promise<{ text: string; languageCode?: string }> {
  const res = await elevenlabs().speechToText.convert({ file, modelId: "scribe_v2" });
  const r = res as { text?: string; languageCode?: string };
  return { text: r.text ?? "", languageCode: r.languageCode };
}

export async function speak(text: string): Promise<ReadableStream<Uint8Array>> {
  return elevenlabs().textToSpeech.convert(env.ELEVENLABS_VOICE_ID, {
    text,
    modelId: "eleven_multilingual_v2",
  });
}

/** Verifies an ElevenLabs webhook (e.g. post-call transcript) and returns the parsed event. */
export async function verifyWebhook(rawBody: string, signature: string) {
  return elevenlabs().webhooks.constructEvent(rawBody, signature, env.ELEVENLABS_WEBHOOK_SECRET);
}

/** Server tools are called by the agent with a shared secret header we configure in the dashboard. */
export function isAuthorisedToolCall(req: Request): boolean {
  return req.headers.get("x-docket-tool-secret") === env.DOCKET_TOOL_SECRET;
}
