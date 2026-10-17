import { z } from "zod";
import { generateStructured, type InlineFile } from "./gemini";

/**
 * Visual inspection of a single photo. Gemini only reports what it sees; evidence/authenticity.ts
 * turns that and the file's metadata into a verdict. This is indicative, never proof: current
 * detectors, including this one, are fallible in both directions.
 */
export const VisualCheckSchema = z.object({
  suspicion: z.enum(["none", "low", "medium", "high"]),
  signs: z
    .array(z.string())
    .max(6)
    .describe("Specific visible signs, each naming where in the image, e.g. 'mould texture repeats identically on the left wall and ceiling'"),
  looksLikePhotoOfRealHome: z.boolean(),
});
export type VisualCheck = z.infer<typeof VisualCheckSchema>;

const SYSTEM = `You examine a tenant's photo of a repair problem (damp, mould, leak, broken fitting) submitted as evidence.
Look for signs it was AI-generated or edited: repeated or cloned textures, smeared or blurred patches next to sharp
areas, inconsistent lighting or shadows, impossible geometry, warped text or fixtures, unnaturally clean or
"illustration-like" surfaces, mismatched noise or resolution between regions, visible edit artefacts.
Be conservative and honest. Ordinary phone photos are often soft, dark or noisy; that is NOT a sign of tampering.
Only report signs you can point to in the image. If you see nothing specific, answer suspicion "none" with no signs.`;

export async function inspectPhoto(file: InlineFile) {
  return generateStructured({ schema: VisualCheckSchema, system: SYSTEM, prompt: "Inspect this photo.", files: [file] });
}
