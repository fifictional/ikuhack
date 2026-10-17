import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { after } from "next/server";
import { copyLeaf, recordLeaf } from "@/lib/compliance/leaves";
import { buildMerkle, verifyMerkle } from "@/lib/evidence/merkle";

/**
 * Tamper-evidence: batch every new evidence hash + the head of every case's
 * event hash-chain into a Merkle tree, and write the root to Solana as a memo.
 * DEVNET ONLY — this uses a throwaway keypair funded by the devnet faucet.
 */

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const explorerUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${env.SOLANA_CLUSTER}`;

export async function writeMemo(text: string): Promise<string> {
  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const payer = Keypair.fromSecretKey(bs58.decode(env.SOLANA_SECRET_KEY));
  const ix = new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM,
    data: Buffer.from(text, "utf8"),
  });
  return sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
}

export type LeafKind = "evidence" | "case_head" | "compliance_record" | "compliance_copy" | "compliance_certificate";

// One anchoring run at a time per process: event-triggered runs and the cron must not double-anchor the same leaves.
let running: Promise<unknown> = Promise.resolve();

/** Anchor everything not yet anchored. Returns null when there is nothing new. */
export function anchorPending() {
  const run = running.then(() => anchorPendingNow(), () => anchorPendingNow());
  running = run.catch(() => undefined);
  return run;
}

/** Anchor in the background after the response (key events: breach letter, new certificate, copy sent). */
export function anchorSoon() {
  after(() => anchorPending().catch((e) => console.warn("Background anchoring failed:", e instanceof Error ? e.message : e)));
}

async function anchorPendingNow() {
  const evidence = await db()`
    SELECT e.id, e.sha256 AS leaf FROM evidence e
    WHERE NOT EXISTS (SELECT 1 FROM anchor_leaves l WHERE l.ref_id = e.id AND l.leaf_kind = 'evidence')
    ORDER BY e.created_at`;
  const heads = await db()`
    SELECT DISTINCT ON (case_id) case_id AS id, hash AS leaf FROM case_events ORDER BY case_id, seq DESC`;
  const freshHeads = [];
  for (const h of heads) {
    const [seen] = await db()`SELECT 1 FROM anchor_leaves WHERE leaf = ${h.leaf} AND leaf_kind = 'case_head'`;
    if (!seen) freshHeads.push(h);
  }
  const records = await db()`
    SELECT id, property_id, kind, performed_at, copy_sent_at, certificate_sha256 FROM compliance_records`;
  const candidates: { kind: LeafKind; id: string; leaf: string }[] = [];
  for (const r of records) {
    candidates.push({
      kind: "compliance_record",
      id: r.id,
      leaf: recordLeaf({ id: r.id, propertyId: r.property_id, kind: r.kind, performedAt: r.performed_at, certificateSha256: r.certificate_sha256 }),
    });
    if (r.certificate_sha256) candidates.push({ kind: "compliance_certificate", id: r.id, leaf: r.certificate_sha256 });
    if (r.copy_sent_at) candidates.push({ kind: "compliance_copy", id: r.id, leaf: copyLeaf({ id: r.id, copySentAt: r.copy_sent_at }) });
  }
  const seen = new Set(
    (await db()<{ leaf: string }[]>`SELECT leaf FROM anchor_leaves WHERE leaf IN ${db()(candidates.map((c) => c.leaf).concat("-"))}`).map((r) => r.leaf),
  );
  const freshCompliance = candidates.filter((c) => !seen.has(c.leaf));

  const leaves: { kind: LeafKind; id: string; leaf: string }[] = [
    ...evidence.map((e) => ({ kind: "evidence" as const, id: e.id as string, leaf: e.leaf as string })),
    ...freshHeads.map((h) => ({ kind: "case_head" as const, id: h.id as string, leaf: h.leaf as string })),
    ...freshCompliance,
  ];
  if (leaves.length === 0) return null;

  const tree = buildMerkle(leaves.map((l) => l.leaf));
  const signature = await writeMemo(`docket:v1:${tree.root}`);

  const [anchor] = await db()`
    INSERT INTO anchors (merkle_root, leaf_count, cluster, tx_signature)
    VALUES (${tree.root}, ${leaves.length}, ${env.SOLANA_CLUSTER}, ${signature}) RETURNING id`;
  for (const [i, l] of leaves.entries()) {
    await db()`INSERT INTO anchor_leaves (anchor_id, leaf, leaf_kind, ref_id, proof)
               VALUES (${anchor.id}, ${l.leaf}, ${l.kind}, ${l.id}, ${db().json(tree.proofs[i])})`;
  }
  return { anchorId: anchor.id as string, root: tree.root, signature, url: explorerUrl(signature), leaves: leaves.length };
}

export async function listAnchors(limit = 5) {
  return db()<{ id: string; merkle_root: string; leaf_count: number; cluster: string; tx_signature: string | null; created_at: Date }[]>`
    SELECT id, merkle_root, leaf_count, cluster, tx_signature, created_at
    FROM anchors ORDER BY created_at DESC LIMIT ${limit}`;
}

export interface OnChainCheck {
  checked: boolean;
  /** True when the memo stored on Solana is exactly this root. */
  matches?: boolean;
  slot?: number;
  blockTime?: string | null;
  signer?: string;
  error?: string;
}

/**
 * Read the transaction straight from a Solana RPC node and compare its memo with the root. This is what
 * makes verification independent of our database: if someone altered our records, the chain wouldn't match.
 */
export async function verifyOnChain(signature: string, root: string): Promise<OnChainCheck> {
  try {
    const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
    const tx = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) return { checked: true, matches: false, error: "Transaction not found on this cluster" };
    const memo = tx.transaction.message.instructions.find((i) => "parsed" in i && i.program === "spl-memo") as
      | { parsed: string }
      | undefined;
    return {
      checked: true,
      matches: memo?.parsed === `docket:v1:${root}` && !tx.meta?.err,
      slot: tx.slot,
      blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
      signer: tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58(),
    };
  } catch (e) {
    return { checked: false, error: e instanceof Error ? e.message : "RPC unavailable" };
  }
}

/** Look up a hash and prove it is included in an anchored root. `onChain` also re-reads the root from Solana. */
export async function verifyLeaf(leaf: string, opts: { onChain?: boolean } = {}) {
  const [row] = await db()`
    SELECT l.leaf, l.leaf_kind, l.ref_id, l.proof, a.merkle_root, a.tx_signature, a.cluster, a.created_at
    FROM anchor_leaves l JOIN anchors a ON a.id = l.anchor_id WHERE l.leaf = ${leaf} LIMIT 1`;
  if (!row) return { anchored: false as const };
  const onChain = opts.onChain && row.tx_signature ? await verifyOnChain(row.tx_signature, row.merkle_root) : undefined;
  return {
    anchored: true as const,
    valid: verifyMerkle(row.leaf, row.proof as string[], row.merkle_root),
    root: row.merkle_root as string,
    kind: row.leaf_kind as LeafKind,
    refId: row.ref_id as string,
    anchoredAt: row.created_at as Date,
    url: row.tx_signature ? explorerUrl(row.tx_signature) : null,
    signature: (row.tx_signature as string | null) ?? null,
    cluster: row.cluster as string,
    /** Everything needed to re-check this offline: hash + sibling hashes + root + transaction. */
    proof: row.proof as string[],
    onChain,
  };
}
