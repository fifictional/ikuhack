import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";

let client: GoogleGenAI | undefined;
export function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

export interface InlineFile {
  mimeType: string;
  /** base64 */
  data: string;
}

/**
 * Primary model first, then fallbacks. Free-tier quotas are per model (5 req/min),
 * so falling through the chain keeps intake working when one model is rate-limited.
 */
export function modelChain(): string[] {
  return [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS].filter((m, i, all) => m && all.indexOf(m) === i);
}

const RETRYABLE = new Set([429, 500, 503]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Calls Gemini with a JSON schema derived from a zod schema and validates the reply. */
export async function generateStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  files?: InlineFile[];
}): Promise<z.infer<T> & { _model: string }> {
  let lastError: unknown;
  for (const model of modelChain()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await gemini().models.generateContent({
          model,
          contents: [
            { role: "user", parts: [{ text: opts.prompt }, ...(opts.files ?? []).map((f) => ({ inlineData: f }))] },
          ],
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(opts.schema),
            // Extraction doesn't need deep reasoning; low thinking roughly halves latency.
            thinkingConfig: { thinkingLevel: env.GEMINI_THINKING as ThinkingLevel },
          },
        });
        const parsed = opts.schema.parse(JSON.parse(res.text ?? "{}")) as z.infer<T>;
        return Object.assign(parsed as object, { _model: model }) as z.infer<T> & { _model: string };
      } catch (err) {
        lastError = err;
        const status = err instanceof ApiError ? err.status : 0;
        if (!RETRYABLE.has(status)) throw err;
        if (attempt === 0) await sleep(1500);
      }
    }
  }
  throw lastError;
}
