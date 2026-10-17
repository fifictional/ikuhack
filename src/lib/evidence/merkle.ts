import { sha256Hex } from "./hash";

/**
 * Minimal Merkle tree over hex leaves. Pairs are hashed in sorted order so a
 * proof is just the list of sibling hashes (no left/right flags needed).
 */
const pair = (a: string, b: string) => sha256Hex(Buffer.from(a < b ? a + b : b + a, "hex"));

export interface MerkleTree {
  root: string;
  proofs: string[][];
}

export function buildMerkle(leaves: string[]): MerkleTree {
  if (leaves.length === 0) throw new Error("No leaves to anchor");
  const proofs: string[][] = leaves.map(() => []);
  let level = leaves.map((leaf, i) => ({ hash: leaf, members: [i] }));
  while (level.length > 1) {
    const next: typeof level = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left; // duplicate last node on odd levels
      for (const m of left.members) proofs[m].push(right.hash);
      if (right !== left) for (const m of right.members) proofs[m].push(left.hash);
      next.push({ hash: pair(left.hash, right.hash), members: right === left ? left.members : [...left.members, ...right.members] });
    }
    level = next;
  }
  return { root: level[0].hash, proofs };
}

export function verifyMerkle(leaf: string, proof: string[], root: string): boolean {
  return proof.reduce((acc, sibling) => pair(acc, sibling), leaf) === root;
}
