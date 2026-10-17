import { z } from "zod";
import { generateStructured } from "./gemini";

/**
 * Polishes and translates escalation letters.
 *
 * The engine produces the facts, dates, deadlines and citations. Gemini only
 * rewrites the *prose*: it must not add or change any of those. A guard checks
 * that every date, number and bracketed placeholder survived; if Gemini fails
 * or drops one, we return the original template unchanged.
 */

const LANGUAGE_NAME: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pl: "Polish", pt: "Portuguese",
  ar: "Arabic", bn: "Bengali", ur: "Urdu", hi: "Hindi", zh: "Chinese", ro: "Romanian", it: "Italian", tr: "Turkish",
};

// Letters are deterministic enough to reuse; keeps repeat drafts off the Gemini quota.
const cache = new Map<string, string>();

const DATE = /\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/g;
const PLACEHOLDER = /\[TENANT TO [^\]]+\]/g;
const NUMBER = /\b\d+\b/g;

/** Every token the rewrite must preserve verbatim. */
export function protectedTokens(text: string): string[] {
  return [...new Set([...(text.match(DATE) ?? []), ...(text.match(PLACEHOLDER) ?? []), ...(text.match(NUMBER) ?? [])])];
}

export function preservesProtectedFacts(original: string, rewritten: string): boolean {
  const dates = original.match(DATE) ?? [];
  const placeholders = original.match(PLACEHOLDER) ?? [];
  const numbers = original.match(NUMBER) ?? [];
  return (
    dates.every((t) => rewritten.includes(t)) &&
    placeholders.every((t) => rewritten.includes(t)) &&
    // Word boundaries so "20" isn't satisfied by "2026".
    numbers.every((t) => new RegExp(`\\b${t}\\b`).test(rewritten))
  );
}

export async function polishLetter(text: string, lang: string | null | undefined): Promise<string> {
  const code = (lang ?? "en").toLowerCase().split("-")[0];
  const language = LANGUAGE_NAME[code] ?? (code === "en" ? "English" : code);
  const key = `${code}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const out = await generateStructured({
      schema: z.object({ letter: z.string() }),
      system:
        `You are a careful legal-document editor for a UK housing service. Rewrite the tenant's letter in ${language}. ` +
        "Improve clarity, tone and flow. You must NOT change any fact, name, address, date, deadline, number, legal citation, " +
        "statute name, section number or bracketed placeholder. Keep every number as digits (e.g. 20, 24, 1985). " +
        "Keep every section and the overall meaning. Do not add advice, new claims, new deadlines or anything not in the original. " +
        "Return only the rewritten letter.",
      prompt: `Letter to rewrite:\n\n${text}`,
    });
    const letter = out.letter.trim();
    if (!letter || !preservesProtectedFacts(text, letter)) return text;
    cache.set(key, letter);
    return letter;
  } catch {
    // Gemini unavailable or over quota — the templated letter is still correct.
    return text;
  }
}
