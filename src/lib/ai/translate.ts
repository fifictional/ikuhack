import { z } from "zod";
import { generateStructured } from "./gemini";

const LANGUAGE_NAME: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pl: "Polish", pt: "Portuguese",
  ar: "Arabic", bn: "Bengali", ur: "Urdu", hi: "Hindi", zh: "Chinese", ro: "Romanian", it: "Italian", tr: "Turkish",
};

// Translations are deterministic enough to reuse; this keeps repeat taps off the 5 req/min Gemini limit.
const cache = new Map<string, string>();

/**
 * Plain-language translation of a case update. Gemini only rewords text the engine already produced;
 * it never adds or changes dates, durations or legal claims (the prompt forbids it).
 */
export async function translateForTenant(text: string, lang: string | null | undefined): Promise<string> {
  const code = (lang ?? "en").toLowerCase().split("-")[0];
  if (code === "en") return text;
  const language = LANGUAGE_NAME[code] ?? code;
  const key = `${code}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const out = await generateStructured({
    schema: z.object({ translation: z.string() }),
    system:
      "You translate short tenant-facing repair updates. Keep every date, time, number and name exactly as given. " +
      "Do not add, remove or soften anything, and add no advice. Use simple, spoken-style language.",
    prompt: `Translate into ${language}:\n\n${text}`,
  });
  cache.set(key, out.translation);
  return out.translation;
}
