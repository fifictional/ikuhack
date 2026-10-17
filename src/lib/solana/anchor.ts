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

/** Anchor everything not yet anchored. Returns null when there is nothing new. */
export async function anchorPending() {
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
  const leaves = [
    ...evidence.map((e) => ({ kind: "evidence", id: e.id as string, leaf: e.leaf as string })),
    ...freshHeads.map((h) => ({ kind: "case_head", id: h.id as string, leaf: h.leaf as string })),
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

/** Look up a hash and prove it is included in an anchored root. */
export async function verifyLeaf(leaf: string) {
  const [row] = await db()`
    SELECT l.leaf, l.leaf_kind, l.ref_id, l.proof, a.merkle_root, a.tx_signature, a.cluster, a.created_at
    FROM anchor_leaves l JOIN anchors a ON a.id = l.anchor_id WHERE l.leaf = ${leaf} LIMIT 1`;
  if (!row) return { anchored: false as const };
  return {
    anchored: true as const,
    valid: verifyMerkle(row.leaf, row.proof as string[], row.merkle_root),
    root: row.merkle_root as string,
    kind: row.leaf_kind as string,
    refId: row.ref_id as string,
    anchoredAt: row.created_at as Date,
    url: row.tx_signature ? explorerUrl(row.tx_signature) : null,
  };
}
