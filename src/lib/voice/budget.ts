import { db } from "@/lib/db/client";
import { londonYmd } from "@/lib/engine/working-days";
import { elevenlabs } from "./elevenlabs";

/**
 * Protects ElevenLabs credits so there's enough left for the live demo.
 * Every paid call (agent session, TTS, Scribe) goes through guardVoice() first:
 *  - VOICE_ENABLED=false switches voice off entirely (default for day-to-day dev).
 *  - ELEVENLABS_RESERVE_CREDITS is held back: calls are refused once the real
 *    account balance would drop below it. Lower it on demo day.
 *  - ELEVENLABS_MAX_SESSIONS_PER_DAY caps agent conversations, the biggest spend.
 */

export class VoiceBudgetError extends Error {
  name = "VoiceBudgetError";
}

const reserve = () => Number(process.env.ELEVENLABS_RESERVE_CREDITS ?? 10_000);
const maxSessions = () => Number(process.env.ELEVENLABS_MAX_SESSIONS_PER_DAY ?? 20);
export const voiceEnabled = () => process.env.VOICE_ENABLED !== "false";

let cache: { at: number; remaining: number | null } | undefined;

/** Remaining credits on the account, cached for 60s. null if the key can't read usage. */
export async function remainingCredits(): Promise<number | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.remaining;
  let remaining: number | null = null;
  try {
    const s = await elevenlabs().user.subscription.get();
    remaining = s.characterLimit - s.characterCount;
  } catch {
    // API key lacks the "User: read" permission — fall back to the session cap only.
  }
  cache = { at: Date.now(), remaining };
  return remaining;
}

const sessionKey = () => `voice_sessions:${londonYmd(new Date())}`;

export async function sessionsToday(): Promise<number> {
  const [row] = await db()`SELECT value FROM app_settings WHERE key = ${sessionKey()}`;
  return Number(row?.value ?? 0);
}

/**
 * Throws VoiceBudgetError (→ HTTP 429) if this call would eat into the demo reserve.
 * `estimatedCredits` is the expected cost (TTS ≈ characters; Flash models cost less).
 */
export async function guardVoice(kind: "agent" | "tts" | "stt", estimatedCredits = 0): Promise<void> {
  if (!voiceEnabled()) throw new VoiceBudgetError("Voice is switched off (VOICE_ENABLED=false). Type your report instead.");

  const remaining = await remainingCredits();
  if (remaining !== null && remaining - estimatedCredits < reserve()) {
    throw new VoiceBudgetError(
      `Voice paused to protect the demo: ${remaining} ElevenLabs credits left, ${reserve()} held in reserve.`,
    );
  }

  if (kind === "agent") {
    const [row] = await db()`
      INSERT INTO app_settings (key, value) VALUES (${sessionKey()}, '1'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = to_jsonb((app_settings.value)::text::int + 1)
      RETURNING value`;
    if (Number(row.value) > maxSessions()) {
      throw new VoiceBudgetError(`Daily voice limit reached (${maxSessions()} conversations). Type your report instead.`);
    }
  }
}

export async function voiceUsage() {
  return {
    enabled: voiceEnabled(),
    remainingCredits: await remainingCredits(),
    reserve: reserve(),
    sessionsToday: await sessionsToday(),
    maxSessionsPerDay: maxSessions(),
  };
}
