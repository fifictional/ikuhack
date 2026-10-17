import { db } from "@/lib/db/client";
import { explorerUrl, verifyOnChain, type LeafKind, type OnChainCheck } from "./anchor";

export interface BatchSummary {
  id: string;
  root: string;
  createdAt: Date;
  cluster: string;
  signature: string | null;
  url: string | null;
  total: number;
  byKind: Partial<Record<LeafKind, number>>;
}

/** Recent batches with what each one contains, for the /proof page. */
export async function recentBatches(limit = 6): Promise<BatchSummary[]> {
  const rows = await db()<
    { id: string; merkle_root: string; created_at: Date; cluster: string; tx_signature: string | null; kind: LeafKind | null; n: number }[]
  >`
    SELECT a.id, a.merkle_root, a.created_at, a.cluster, a.tx_signature, l.leaf_kind AS kind, count(l.leaf)::int AS n
    FROM (SELECT * FROM anchors ORDER BY created_at DESC LIMIT ${limit}) a
    LEFT JOIN anchor_leaves l ON l.anchor_id = a.id
    GROUP BY a.id, a.merkle_root, a.created_at, a.cluster, a.tx_signature, l.leaf_kind
    ORDER BY a.created_at DESC`;
  const byId = new Map<string, BatchSummary>();
  for (const r of rows) {
    const b = byId.get(r.id) ?? {
      id: r.id, root: r.merkle_root, createdAt: r.created_at, cluster: r.cluster, signature: r.tx_signature,
      url: r.tx_signature ? explorerUrl(r.tx_signature) : null, total: 0, byKind: {},
    };
    if (r.kind) {
      b.byKind[r.kind] = r.n;
      b.total += r.n;
    }
    byId.set(r.id, b);
  }
  return [...byId.values()];
}

export async function proofTotals() {
  const [t] = await db()<{ batches: number; leaves: number }[]>`
    SELECT (SELECT count(*) FROM anchors)::int AS batches, (SELECT count(*) FROM anchor_leaves)::int AS leaves`;
  return t;
}

export async function latestOnChain(batch: BatchSummary | undefined): Promise<OnChainCheck | null> {
  if (!batch?.signature) return null;
  return verifyOnChain(batch.signature, batch.root);
}

export interface ComplianceProof {
  id: string;
  propertyId: string;
  address: string;
  kind: "gas_safety" | "eicr";
  performedAt: Date;
  copySentAt: Date | null;
  hasCertificate: boolean;
  certificateSha256: string | null;
  record: { anchoredAt: Date; url: string | null } | null;
  copy: { anchoredAt: Date; url: string | null } | null;
}

/** Each inspection with proof that the record (and the tenant's copy) is anchored on Solana. */
export async function getComplianceProofs(landlordId: string): Promise<ComplianceProof[]> {
  const rows = await db()`
    SELECT r.id, r.property_id, r.kind, r.performed_at, r.copy_sent_at, r.certificate_sha256,
           p.address || ', ' || p.postcode AS address,
           rec.created_at AS rec_at, rec.tx_signature AS rec_tx,
           cp.created_at AS copy_at, cp.tx_signature AS copy_tx
    FROM compliance_records r
    JOIN properties p ON p.id = r.property_id
    LEFT JOIN LATERAL (SELECT a.created_at, a.tx_signature FROM anchor_leaves l JOIN anchors a ON a.id = l.anchor_id
                       WHERE l.ref_id = r.id AND l.leaf_kind = 'compliance_record' LIMIT 1) rec ON true
    LEFT JOIN LATERAL (SELECT a.created_at, a.tx_signature FROM anchor_leaves l JOIN anchors a ON a.id = l.anchor_id
                       WHERE l.ref_id = r.id AND l.leaf_kind = 'compliance_copy' LIMIT 1) cp ON true
    WHERE p.landlord_id = ${landlordId}
    ORDER BY r.performed_at DESC`;
  const link = (at: Date | null, tx: string | null) => (at ? { anchoredAt: at, url: tx ? explorerUrl(tx) : null } : null);
  return rows.map((r) => ({
    id: r.id, propertyId: r.property_id, address: r.address, kind: r.kind, performedAt: r.performed_at,
    copySentAt: r.copy_sent_at, hasCertificate: !!r.certificate_sha256, certificateSha256: r.certificate_sha256,
    record: link(r.rec_at, r.rec_tx), copy: link(r.copy_at, r.copy_tx),
  }));
}
