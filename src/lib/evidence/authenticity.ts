import exifr from "exifr";
import { inspectPhoto, type VisualCheck } from "@/lib/ai/image-forensics";
import { db } from "@/lib/db/client";
import { getNow } from "@/lib/db/settings";
import { getEvidence } from "./store";

/**
 * Is this tenant photo what it appears to be? Three independent layers, none of which is proof:
 *  1. Integrity: the stored hash still matches the bytes (tamper-evidence since upload).
 *  2. Provenance: metadata and content credentials (camera, editing software, AI markers, capture time, reuse).
 *  3. Visual: Gemini looks for generation/editing artefacts.
 * `assess()` is pure and deterministic, so the same signals always give the same verdict.
 */

export type Level = "ok" | "info" | "warn" | "alert";
export interface Signal {
  id: string;
  level: Level;
  label: string;
  detail: string;
}

export type Verdict = "no_concerns" | "unverified" | "needs_review" | "likely_manipulated";

export interface Facts {
  hashMatches: boolean;
  /** Parsed metadata; all optional because messaging apps and screenshots strip it. */
  make?: string;
  model?: string;
  software?: string;
  capturedAt?: Date;
  modifiedAt?: Date;
  /** XMP/IPTC DigitalSourceType, if present. */
  digitalSourceType?: string;
  hasContentCredentials: boolean;
  uploadedAt: Date;
  caseOpenedAt: Date;
  /** Other cases this exact file was also submitted to. */
  reusedInCases: number;
  visual?: VisualCheck;
}

const EDITORS = /photoshop|lightroom|gimp|snapseed|pixelmator|affinity|canva|picsart|facetune|photopea|paint\.net|fotor|remini/i;
const GENERATORS = /midjourney|dall[\s-]?e|stable[\s-]?diffusion|firefly|imagen|gemini|openai|flux|runware|leonardo|ideogram|nano[\s-]?banana|comfyui/i;
const AI_SOURCE = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;
const MINUTE = 60_000;

export function assess(f: Facts): { verdict: Verdict; signals: Signal[] } {
  const s: Signal[] = [];
  const add = (id: string, level: Level, label: string, detail: string) => s.push({ id, level, label, detail });

  if (f.hashMatches) add("integrity", "ok", "File unchanged since upload", "Its fingerprint still matches the one logged in the case record.");
  else add("integrity", "alert", "File differs from the logged fingerprint", "The stored bytes no longer match the hash recorded when it was uploaded.");

  if (AI_SOURCE.test(f.digitalSourceType ?? "")) {
    add("ai-marker", "alert", "Marked as AI-generated", `The file's own metadata declares it AI-made (${f.digitalSourceType}).`);
  }
  if (f.software && GENERATORS.test(f.software)) {
    add("ai-software", "alert", "Created by an AI tool", `Metadata names the software "${f.software}".`);
  } else if (f.software && EDITORS.test(f.software)) {
    add("editor", "warn", "Edited in photo software", `Metadata names "${f.software}". Edits aren't necessarily dishonest, but the image isn't an untouched camera original.`);
  }
  if (f.hasContentCredentials && !AI_SOURCE.test(f.digitalSourceType ?? "")) {
    add("c2pa", "info", "Has content credentials", "A signed provenance record (C2PA) is embedded. Verify it with a C2PA tool for the full edit history.");
  }

  const camera = [f.make, f.model].filter(Boolean).join(" ");
  if (camera) add("camera", "ok", "Camera details present", `Shot on ${camera}.`);
  else add("no-camera", "info", "No camera details", "Messaging apps, screenshots and AI tools all strip or lack this, so it can't be verified either way.");

  if (f.capturedAt) {
    const takenMs = f.capturedAt.getTime();
    if (takenMs > f.uploadedAt.getTime() + 5 * MINUTE) {
      add("future", "warn", "Captured after it was uploaded", "The capture time is later than the upload time, which suggests a wrong clock or edited metadata.");
    } else if (takenMs < f.caseOpenedAt.getTime() - 30 * 86_400_000) {
      add("old", "warn", "Taken long before the report", `Captured ${f.capturedAt.toISOString().slice(0, 10)}, over 30 days before the case was opened.`);
    } else {
      add("time-ok", "ok", "Capture time fits the case", `Captured ${f.capturedAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`);
    }
    if (f.modifiedAt && Math.abs(f.modifiedAt.getTime() - takenMs) > 10 * MINUTE) {
      add("modified", "warn", "Changed after it was taken", "The file's modified time differs from its capture time, so it was re-saved or edited later.");
    }
  }

  if (f.reusedInCases > 0) {
    add("reused", "alert", "Same file used in another case", `This exact image was also submitted to ${f.reusedInCases} other case${f.reusedInCases === 1 ? "" : "s"}.`);
  }

  if (f.visual) {
    const { suspicion, signs } = f.visual;
    const detail = signs.length ? signs.join("; ") : "Nothing specific stood out.";
    if (suspicion === "high") add("visual", "alert", "Visual check: strong signs of generation or editing", detail);
    else if (suspicion === "medium") add("visual", "warn", "Visual check: some irregularities", detail);
    else if (suspicion === "low") add("visual", "info", "Visual check: minor oddities", detail);
    else add("visual", "ok", "Visual check: nothing unusual", detail);
  } else {
    add("visual", "info", "Visual check not run", "Gemini was unavailable, so only metadata was checked.");
  }

  const has = (l: Level) => s.some((x) => x.level === l);
  const hard = s.some((x) => x.level === "alert" && x.id !== "visual");
  let verdict: Verdict;
  if (hard) verdict = "likely_manipulated";
  else if (has("alert") || has("warn")) verdict = "needs_review";
  // Metadata alone can't clear a photo: with nothing to show it came from a camera, say so rather than "fine".
  else if (!camera && !f.hasContentCredentials) verdict = "unverified";
  else verdict = "no_concerns";
  return { verdict, signals: s };
}

async function readMetadata(bytes: Uint8Array) {
  const buf = Buffer.from(bytes);
  const m = await exifr.parse(buf, { tiff: true, exif: true, xmp: true, iptc: true, mergeOutput: true }).catch(() => undefined);
  const dsrc = (m?.DigitalSourceType ?? m?.DigitalSourceFileType) as string | undefined;
  // C2PA manifests live in JUMBF boxes tagged "c2pa"; presence is enough to tell the reader to verify it.
  const hasContentCredentials = buf.includes("c2pa") && buf.includes("jumb");
  const toDate = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : undefined);
  return {
    make: m?.Make as string | undefined,
    model: m?.Model as string | undefined,
    software: (m?.Software ?? m?.CreatorTool) as string | undefined,
    capturedAt: toDate(m?.DateTimeOriginal),
    modifiedAt: toDate(m?.ModifyDate),
    digitalSourceType: dsrc,
    hasContentCredentials,
  };
}

export interface AuthenticityReport {
  evidenceId: string;
  verdict: Verdict;
  signals: Signal[];
  checkedAt: string;
  model?: string;
}

/** Run (or return the cached) authenticity check for one photo. Cached by file hash: the file can't change. */
export async function checkAuthenticity(evidenceId: string, opts: { refresh?: boolean } = {}): Promise<AuthenticityReport | null> {
  const e = await getEvidence(evidenceId);
  if (!e || e.kind !== "photo") return null;
  if (!opts.refresh) {
    const [hit] = await db()<{ result: AuthenticityReport }[]>`SELECT result FROM evidence_checks WHERE evidence_id = ${evidenceId} AND sha256 = ${e.sha256}`;
    if (hit) return hit.result;
  }

  const bytes = new Uint8Array(e.bytes);
  const { createHash } = await import("node:crypto");
  const hashMatches = createHash("sha256").update(bytes).digest("hex") === e.sha256;
  const [[c], [reuse]] = await Promise.all([
    db()<{ opened_at: Date }[]>`SELECT opened_at FROM cases WHERE id = ${e.case_id}`,
    db()<{ n: number }[]>`SELECT count(DISTINCT case_id)::int AS n FROM evidence WHERE sha256 = ${e.sha256} AND case_id <> ${e.case_id}`,
  ]);

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

  const { verdict, signals } = assess({
    hashMatches,
    ...meta,
    uploadedAt: e.created_at,
    caseOpenedAt: c?.opened_at ?? e.created_at,
    reusedInCases: reuse?.n ?? 0,
    visual,
  });
  const report: AuthenticityReport = { evidenceId, verdict, signals, checkedAt: (await getNow()).toISOString(), model };
  // A run without the visual layer is incomplete; don't cache it so a retry can fill it in.
  if (visual) {
    await db()`INSERT INTO evidence_checks (evidence_id, sha256, result) VALUES (${evidenceId}, ${e.sha256}, ${db().json(report as never)})
               ON CONFLICT (evidence_id) DO UPDATE SET sha256 = EXCLUDED.sha256, result = EXCLUDED.result, checked_at = now()`;
  }
  return report;
}
