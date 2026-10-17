import exifr from "exifr";
import { inspectPhoto, type VisualCheck } from "@/lib/ai/image-forensics";
import { db } from "@/lib/db/client";
import { getNow } from "@/lib/db/settings";
import { getEvidence } from "./store";

/**
 * A simple "does this look like a real, untouched photo?" check run on every uploaded image:
 *  1. Metadata: an AI tool or editing program named in the file, or an "AI-generated" label.
 *  2. Gemini looks at the picture for generation or editing artefacts.
 * It is a screen, not proof: good fakes pass and odd real photos can be flagged, so a landlord is told to ask for the original.
 * `assess()` is pure, so the same signals always give the same verdict.
 */

export type Level = "ok" | "info" | "warn" | "alert";
export interface Signal {
  id: string;
  level: Level;
  label: string;
  detail: string;
}

export type Verdict = "looks_real" | "needs_review" | "likely_ai_or_edited" | "not_checked";

export interface Facts {
  software?: string;
  /** XMP/IPTC DigitalSourceType, if present. */
  digitalSourceType?: string;
  visual?: VisualCheck;
}

const EDITORS = /photoshop|lightroom|gimp|snapseed|pixelmator|affinity|canva|picsart|facetune|photopea|paint\.net|fotor|remini/i;
const GENERATORS = /midjourney|dall[\s-]?e|stable[\s-]?diffusion|firefly|imagen|gemini|openai|flux|runware|leonardo|ideogram|nano[\s-]?banana|comfyui/i;
const AI_SOURCE = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;

export function assess(f: Facts): { verdict: Verdict; signals: Signal[] } {
  const s: Signal[] = [];
  const add = (id: string, level: Level, label: string, detail: string) => s.push({ id, level, label, detail });

  if (AI_SOURCE.test(f.digitalSourceType ?? "")) {
    add("ai-marker", "alert", "Marked as AI-generated", `The file's own metadata declares it AI-made (${f.digitalSourceType}).`);
  }
  if (f.software && GENERATORS.test(f.software)) {
    add("ai-software", "alert", "Created by an AI tool", `Metadata names the software "${f.software}".`);
  } else if (f.software && EDITORS.test(f.software)) {
    add("editor", "warn", "Edited in photo software", `Metadata names "${f.software}". Edits aren't necessarily dishonest, but this isn't an untouched camera original.`);
  }

  if (f.visual) {
    const { suspicion, signs } = f.visual;
    const detail = signs.length ? signs.join("; ") : "Nothing specific stood out.";
    if (suspicion === "high") add("visual", "alert", "Looks AI-generated or edited", detail);
    else if (suspicion === "medium") add("visual", "warn", "Some irregularities", detail);
    else if (suspicion === "low") add("visual", "info", "Minor oddities", detail);
    else add("visual", "ok", "Nothing unusual in the picture", detail);
  } else {
    add("visual", "info", "Picture check not run", "Gemini was unavailable, so only the file's metadata was checked.");
  }

  const visual = s.find((x) => x.id === "visual");
  const others = s.filter((x) => x.id !== "visual");
  // Metadata that names an AI tool is a fact about the file; the visual check alone is only an opinion, so it
  // needs a second signal before we call a photo likely fake.
  const hard = others.some((x) => x.level === "alert");
  const corroborated = visual?.level === "alert" && others.some((x) => x.level === "warn");
  let verdict: Verdict;
  // Nothing found but the picture itself wasn't examined: say so rather than imply it passed.
  if (!f.visual && !hard && !others.some((x) => x.level === "warn")) verdict = "not_checked";
  else if (hard || corroborated) verdict = "likely_ai_or_edited";
  else if (visual?.level === "alert" || visual?.level === "warn" || others.some((x) => x.level === "warn")) verdict = "needs_review";
  else verdict = "looks_real";
  return { verdict, signals: s };
}

async function readMetadata(bytes: Uint8Array) {
  const m = await exifr.parse(Buffer.from(bytes), { tiff: true, exif: true, xmp: true, iptc: true, mergeOutput: true }).catch(() => undefined);
  return {
    software: (m?.Software ?? m?.CreatorTool) as string | undefined,
    digitalSourceType: (m?.DigitalSourceType ?? m?.DigitalSourceFileType) as string | undefined,
  };
}

export interface AuthenticityReport {
  evidenceId: string;
  verdict: Verdict;
  signals: Signal[];
  checkedAt: string;
  model?: string;
}

/** Run (or return the cached) check for one photo. Cached by file hash: the file can't change. */
export async function checkAuthenticity(evidenceId: string, opts: { refresh?: boolean } = {}): Promise<AuthenticityReport | null> {
  const e = await getEvidence(evidenceId);
  if (!e || e.kind !== "photo") return null;
  if (!opts.refresh) {
    const [hit] = await db()<{ result: AuthenticityReport }[]>`SELECT result FROM evidence_checks WHERE evidence_id = ${evidenceId} AND sha256 = ${e.sha256}`;
    if (hit) return hit.result;
  }

  const bytes = new Uint8Array(e.bytes);
  const meta = await readMetadata(bytes);
  let visual: VisualCheck | undefined;
  let model: string | undefined;
  try {
    const r = await inspectPhoto({ mimeType: e.mime, data: Buffer.from(bytes).toString("base64") });
    visual = r;
    model = r._model;
  } catch (err) {
    console.warn("Visual authenticity check failed:", err instanceof Error ? err.message : err);
  }

  const { verdict, signals } = assess({ ...meta, visual });
  const report: AuthenticityReport = { evidenceId, verdict, signals, checkedAt: (await getNow()).toISOString(), model };
  // A run without the picture check is incomplete; don't cache it so a retry can fill it in.
  if (visual) {
    await db()`INSERT INTO evidence_checks (evidence_id, sha256, result) VALUES (${evidenceId}, ${e.sha256}, ${db().json(report as never)})
               ON CONFLICT (evidence_id) DO UPDATE SET sha256 = EXCLUDED.sha256, result = EXCLUDED.result, checked_at = now()`;
  }
  return report;
}

/** Cached reports for a case's photos, so the landlord sees verdicts without clicking. */
export async function getCachedChecks(evidenceIds: string[]): Promise<Record<string, AuthenticityReport>> {
  if (evidenceIds.length === 0) return {};
  const rows = await db()<{ evidence_id: string; result: AuthenticityReport }[]>`
    SELECT c.evidence_id, c.result FROM evidence_checks c JOIN evidence e ON e.id = c.evidence_id AND e.sha256 = c.sha256
    WHERE c.evidence_id IN ${db()(evidenceIds)}`;
  return Object.fromEntries(rows.map((r) => [r.evidence_id, r.result]));
}

/** How each photo arrived ('live' = taken in Docket's camera, 'upload' = chosen from the device). Browser-reported. */
export async function getCaptureMethods(evidenceIds: string[]): Promise<Record<string, string | null>> {
  if (evidenceIds.length === 0) return {};
  const rows = await db()<{ id: string; capture_method: string | null }[]>`SELECT id, capture_method FROM evidence WHERE id IN ${db()(evidenceIds)}`;
  return Object.fromEntries(rows.map((r) => [r.id, r.capture_method]));
}
