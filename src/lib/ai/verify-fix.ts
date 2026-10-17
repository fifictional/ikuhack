import { z } from "zod";
import { generateStructured, type InlineFile } from "./gemini";

/**
 * Before/after photo comparison. Gemini only reports what it sees; the engine decides what that
 * means (its "not fixed" is weighed against the contractor and tenant in engine/beliefs.ts).
 */

export const FixCheckSchema = z.object({
  verdict: z.enum(["fixed", "not_fixed", "unclear"]),
  confidence: z.number().min(0).max(1),
  sameArea: z.boolean().describe("Do the AFTER photos show the same part of the home as the BEFORE photos?"),
  observations: z.string().describe("One or two plain sentences comparing after with before, e.g. where problems remain"),
  remainingProblems: z.array(z.string()).max(5),
});
export type FixCheck = z.infer<typeof FixCheckSchema>;

const SYSTEM = `You check whether a home repair in England actually fixed the problem a tenant reported.
You get BEFORE photos (from the tenant, showing the problem) and AFTER photos (from the contractor, after the work).
Judge only the reported problem. Be literal and conservative:
- "fixed": the problem is no longer visible in the same area.
- "not_fixed": the problem is still visible, has been covered without being treated (e.g. paint over mould
  with staining or bubbling showing through), or only part of it was dealt with.
- "unclear": the AFTER photos don't show the same area, are too dark or blurry, or don't show enough to tell.
Never guess about things you can't see. Describe specific locations ("top-left corner above the shower").`;

export async function compareFixPhotos(input: { issue: string; before: InlineFile[]; after: InlineFile[] }) {
  return generateStructured({
    schema: FixCheckSchema,
    system: SYSTEM,
    prompt:
      `Reported problem: ${input.issue}\n` +
      `The first ${input.before.length} image(s) are BEFORE. The next ${input.after.length} image(s) are AFTER.`,
    files: [...input.before, ...input.after],
  });
}
