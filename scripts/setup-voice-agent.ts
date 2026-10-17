import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile } from "node:fs/promises";
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { elevenlabs } from "@/lib/voice/elevenlabs";

/**
 * Creates (or updates) the Docket voice intake agent from code, so its prompt, tools and
 * cost limits are versioned with the repo instead of living only in the dashboard.
 *   npm run voice:setup
 * First run creates the agent and writes ELEVENLABS_AGENT_ID to .env.local; later runs update it.
 * Tools are CLIENT tools: the browser runs them against our own API, so no public URL is needed.
 */

const PROMPT = `You are Docket, helping a tenant in England report a problem with their rented home.
Be warm, calm, brief and practical. Always reply in the language the tenant is speaking.
Language switching: the moment the tenant speaks a language other than English (for example Russian), call the
language_detection tool with that language BEFORE you reply, so your voice switches to one that speaks it properly,
then carry on in that language. If they switch back to English, call it again.

Goal: collect enough to log the problem, then call report_issue.
Ask only what's missing, one short question at a time:
1. What is the problem, and where in the home?
2. How long has it been happening, and is it getting worse?
3. Is anyone at home especially vulnerable: a baby or young child, an older person, someone pregnant, ill or disabled?
Safety first: if they mention a gas smell, tell them to leave, not use switches, and call the National Gas Emergency
line on 0800 111 999 straight away, then continue.

When you have the problem and location, call report_issue with a complete description translated into English.
Read back the "message" it returns, in the tenant's language, then ask if there's anything else.
If they ask about an existing repair, call get_case_status and explain the next deadline in plain words.
Never give legal advice, promise outcomes or invent deadlines: only repeat what the tools return.
Corrections: the tenant can fix captions on screen. A message starting "Correction:" means you misheard them; say sorry
briefly and use the corrected version from then on. If you haven't logged the problem yet, use the corrected details.
If you already called report_issue, don't call it again for the same problem: tell them the correction is saved with
their call record.
Pauses: if told the tenant has paused, say nothing at all until you're told they've resumed.
When the tenant is done, say goodbye and end the call.`;

const DESCRIPTION_PARAM: ElevenLabs.LiteralJsonSchemaProperty = {
  type: "string",
  description: "Everything the tenant said about the problem (what, where, how long, getting worse), translated into English.",
};

const tools: ElevenLabs.PromptAgentApiModelOutputToolsItem[] = [
  {
    type: "client",
    name: "report_issue",
    description: "Log the tenant's repair problem with their landlord. Call once you know what the problem is and where.",
    expectsResponse: true,
    responseTimeoutSecs: 30,
    parameters: {
      type: "object",
      required: ["description"],
      properties: {
        description: DESCRIPTION_PARAM,
        original_language: { type: "string", description: "ISO 639-1 code of the language the tenant is speaking, e.g. en, pl, ar." },
        vulnerable_occupant: { type: "boolean", description: "True if a baby, child, older, pregnant, ill or disabled person lives there." },
      },
    },
  } as ElevenLabs.PromptAgentApiModelOutputToolsItem,
  {
    type: "client",
    name: "get_case_status",
    description: "Look up the deadlines on the tenant's most recent repair.",
    expectsResponse: true,
    responseTimeoutSecs: 20,
    parameters: { type: "object", properties: {} },
  } as ElevenLabs.PromptAgentApiModelOutputToolsItem,
];

// Languages common among UK social-housing tenants that Turbo v2.5 supports.
const LANGUAGES = ["pl", "ar", "ro", "es", "pt", "tr", "uk", "hi", "ru"];

// Russian gets Eleven v3 Conversational and its own native-sounding library voice. Override with the env vars below.
// Thai is NOT an agent language (the API rejects it), so Thai reports come through voice notes (Scribe) and the
// Listen button (Eleven v3, see src/lib/voice/elevenlabs.ts); its voice is still added to the account here.
const V3_LANGUAGES: Record<string, { voiceId: string; env: string }> = {
  th: { voiceId: "FaUQoAqt8WX5mfvrvb3A", env: "ELEVENLABS_VOICE_ID_TH" }, // Preecha: patient, friendly, clear
  ru: { voiceId: "CsT9glYAgw8L02hu9od2", env: "ELEVENLABS_VOICE_ID_RU" }, // Marina: warm, expressive
};
const v3Voice = (lang: string) => process.env[V3_LANGUAGES[lang].env] || V3_LANGUAGES[lang].voiceId;

function conversationConfig(voiceId: string): ElevenLabs.ConversationalConfig {
  return {
    agent: {
      firstMessage: "Hi, this is Docket. Tell me what's wrong at home, in whatever language is easiest for you.",
      language: "en",
      maxConversationDurationMessage: "We've reached the time limit for this call. Anything you've told me is saved on your case.",
      prompt: {
        prompt: PROMPT,
        llm: "gemini-3.5-flash",
        temperature: 0.3,
        tools,
        builtInTools: {
          endCall: { name: "end_call", params: { systemToolType: "end_call" } },
          languageDetection: { name: "language_detection", params: { systemToolType: "language_detection" } },
        },
      } as ElevenLabs.PromptAgentApiModelOutput,
    },
    // ElevenLabs requires English agents to use an English-only model. Turbo is noticeably more natural
    // than Flash at the same credit cost; each other language switches to Turbo v2.5 via its preset below.
    // Lower stability = more expressive, less monotone; similarity keeps the voice consistent.
    tts: { modelId: "eleven_turbo_v2", voiceId, stability: 0.4, similarityBoost: 0.8 },
    // Credit protection: hang up after 20s of silence and hard-stop at 3 minutes.
    turn: { silenceEndCallTimeout: 20 },
    conversation: { maxDurationSeconds: 180 },
    languagePresets: Object.fromEntries([
      ...LANGUAGES.filter((l) => !(l in V3_LANGUAGES)).map((l) => [l, { overrides: { agent: { language: l }, tts: { modelId: "eleven_turbo_v2_5" } } }]),
      ...Object.keys(V3_LANGUAGES).filter((l) => LANGUAGES.includes(l)).map((l) => [l, { overrides: { agent: { language: l }, tts: { modelId: "eleven_v3_conversational", voiceId: v3Voice(l) } } }]),
    ]),
  } as ElevenLabs.ConversationalConfig;
}

/** Library voices must be in the account's own voices before an agent can use them. */
async function ensureLibraryVoices(client: ReturnType<typeof elevenlabs>) {
  for (const lang of Object.keys(V3_LANGUAGES)) {
    const voiceId = v3Voice(lang);
    const mine = await client.voices.search({ pageSize: 100 }).catch(() => null);
    if (mine?.voices.some((v) => v.voiceId === voiceId)) continue;
    const shared = await client.voices.getShared({ pageSize: 100, language: lang } as never);
    const found = shared.voices.find((v) => v.voiceId === voiceId);
    if (!found) {
      console.warn(`! ${lang}: voice ${voiceId} isn't in your account or the library for this language; add it in the ElevenLabs voice library.`);
      continue;
    }
    await client.voices.share(found.publicOwnerId, voiceId, { newName: found.name });
    console.log(`+ added ${lang} voice "${found.name}" to your account`);
  }
}

async function main() {
  const client = elevenlabs();
  await ensureLibraryVoices(client);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "Xb7hH8MSUJpSbSDYk0k2";
  const body = {
    name: "Docket intake",
    conversationConfig: conversationConfig(voiceId),
    platformSettings: {
      // Only our server can start sessions (signed URL), so a leaked agent id can't spend credits.
      auth: { enableAuth: true },
      callLimits: { dailyLimit: Number(process.env.ELEVENLABS_MAX_SESSIONS_PER_DAY ?? 20) },
    },
  };

  const existing = process.env.ELEVENLABS_AGENT_ID;
  if (existing) {
    await client.conversationalAi.agents.update(existing, body as ElevenLabs.conversationalAi.UpdateAgentRequest);
    console.log(`✓ Updated agent ${existing}`);
    return;
  }
  const { agentId } = await client.conversationalAi.agents.create(body as ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost);
  const env = await readFile(".env.local", "utf8").catch(() => "");
  const next = /^ELEVENLABS_AGENT_ID=.*$/m.test(env)
    ? env.replace(/^ELEVENLABS_AGENT_ID=.*$/m, `ELEVENLABS_AGENT_ID=${agentId}`)
    : `${env.trimEnd()}\nELEVENLABS_AGENT_ID=${agentId}\n`;
  await writeFile(".env.local", next);
  console.log(`✓ Created agent ${agentId} and saved ELEVENLABS_AGENT_ID to .env.local`);
}

main()
  .catch((e) => {
    console.error(e?.body ?? e);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100));
