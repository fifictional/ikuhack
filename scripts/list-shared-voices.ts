import { config } from "dotenv";
config({ path: ".env.local" });
import { elevenlabs } from "@/lib/voice/elevenlabs";

/** Browse the ElevenLabs voice library for a language: npx tsx scripts/list-shared-voices.ts th */
async function main() {
  const language = process.argv[2] ?? "en";
  const res = await elevenlabs().voices.getShared({ pageSize: 12, language } as never);
  for (const v of res.voices) {
    console.log(`${v.voiceId} | ${v.name} | ${v.gender ?? ""} ${v.age ?? ""} | ${v.accent ?? ""} | ${v.useCase ?? ""} | ${(v.description ?? "").slice(0, 70)} | owner ${v.publicOwnerId}`);
  }
}
main().catch((e) => console.log("ERR", e.statusCode, String(e.message).slice(0, 200)));
