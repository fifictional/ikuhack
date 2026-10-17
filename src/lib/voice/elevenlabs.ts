import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { sha256Hex } from "@/lib/evidence/hash";
import { guardVoice } from "./budget";

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

/** Voice notes are capped so one long recording can't drain credits (~2 min of compressed audio). */
export const MAX_VOICE_NOTE_BYTES = 2 * 1024 * 1024;

export async function transcribe(file: Blob): Promise<{ text: string; languageCode?: string }> {
  await guardVoice("stt");
  const res = await elevenlabs().speechToText.convert({ file, modelId: "scribe_v2" });
  const r = res as { text?: string; languageCode?: string };
  return { text: r.text ?? "", languageCode: r.languageCode };
}

// Flash is multilingual and costs roughly half the credits per character of Multilingual v2.
const TTS_MODEL = "eleven_flash_v2_5";
export const MAX_TTS_CHARS = 600;

/** Text → MP3 bytes, served from cache when the exact same text was spoken before. */
export async function speak(text: string): Promise<Uint8Array> {
  const clipped = text.slice(0, MAX_TTS_CHARS);
  const key = sha256Hex(`${env.ELEVENLABS_VOICE_ID}|${TTS_MODEL}|${clipped}`);
  const [hit] = await db()`SELECT audio FROM tts_cache WHERE key = ${key}`;
  if (hit) return new Uint8Array(hit.audio);

  await guardVoice("tts", clipped.length);
  const stream = await elevenlabs().textToSpeech.convert(env.ELEVENLABS_VOICE_ID, { text: clipped, modelId: TTS_MODEL });
  const audio = new Uint8Array(await new Response(stream).arrayBuffer());
  await db()`INSERT INTO tts_cache (key, audio, chars) VALUES (${key}, ${Buffer.from(audio)}, ${clipped.length})
             ON CONFLICT (key) DO NOTHING`;
  return audio;
}

/** Verifies an ElevenLabs webhook (e.g. post-call transcript) and returns the parsed event. */
export async function verifyWebhook(rawBody: string, signature: string) {
  return elevenlabs().webhooks.constructEvent(rawBody, signature, env.ELEVENLABS_WEBHOOK_SECRET);
}

/** Server tools are called by the agent with a shared secret header we configure in the dashboard. */
export function isAuthorisedToolCall(req: Request): boolean {
  return req.headers.get("x-docket-tool-secret") === env.DOCKET_TOOL_SECRET;
}
