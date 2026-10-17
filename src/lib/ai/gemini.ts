import { GoogleGenAI } from "@google/genai";
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

/** Calls Gemini with a JSON schema derived from a zod schema and validates the reply. */
export async function generateStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  files?: InlineFile[];
}): Promise<z.infer<T>> {
  const res = await gemini().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: opts.prompt }, ...(opts.files ?? []).map((f) => ({ inlineData: f }))],
      },
    ],
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(opts.schema),
      temperature: 0.1,
    },
  });
  return opts.schema.parse(JSON.parse(res.text ?? "{}"));
}
