import { db } from "@/lib/db/client";
import { appendEvent } from "@/lib/cases/service";
import type { Actor } from "@/lib/domain/types";
import { EVIDENCE_KINDS } from "@/lib/domain/types";
import { sha256Hex } from "./hash";

type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Store a file, hash it server-side, and log EVIDENCE_ADDED on the case. */
export async function addEvidence(input: {
  caseId: string;
  uploadedBy: Actor;
  kind: EvidenceKind;
  mime: string;
  bytes: Uint8Array;
  filename?: string;
  caption?: string;
}) {
  const sha256 = sha256Hex(input.bytes);
  const [row] = await db()`
    INSERT INTO evidence (case_id, kind, mime, filename, caption, sha256, bytes, uploaded_by)
    VALUES (${input.caseId}, ${input.kind}, ${input.mime}, ${input.filename ?? null}, ${input.caption ?? null},
            ${sha256}, ${Buffer.from(input.bytes)}, ${input.uploadedBy})
    RETURNING id`;
  await appendEvent(input.caseId, input.uploadedBy, {
    type: "EVIDENCE_ADDED",
    evidenceId: row.id,
    sha256,
    kind: input.kind,
    caption: input.caption,
  });
  return { evidenceId: row.id as string, sha256 };
}

export async function getEvidence(id: string) {
  const [row] = await db()`SELECT id, case_id, kind, mime, filename, caption, sha256, bytes, created_at FROM evidence WHERE id = ${id}`;
  return row ?? null;
}
