import { sha256Hex } from "@/lib/evidence/hash";

/**
 * What gets anchored for a compliance record. Both leaves are deterministic hashes of the record's
 * fields, so anyone holding the same facts can recompute them and check them against the chain.
 * The version prefix lets the format change without invalidating old proofs.
 */
export interface RecordLeafInput {
  id: string;
  propertyId: string;
  kind: string;
  performedAt: Date | string;
  certificateSha256?: string | null;
}

const iso = (d: Date | string) => new Date(d).toISOString();

/** "This inspection happened on this date (and this certificate backs it)". */
export const recordLeaf = (r: RecordLeafInput) =>
  sha256Hex(`docket:compliance:v1|${r.id}|${r.propertyId}|${r.kind}|${iso(r.performedAt)}|${r.certificateSha256 ?? ""}`);

/** "The tenant was given their copy at this time": the timestamp that settles a 28-day dispute. */
export const copyLeaf = (r: { id: string; copySentAt: Date | string }) =>
  sha256Hex(`docket:copy:v1|${r.id}|${iso(r.copySentAt)}`);
