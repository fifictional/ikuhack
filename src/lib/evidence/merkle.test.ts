import { describe, expect, it } from "vitest";
import { buildMerkle, verifyMerkle } from "./merkle";
import { sha256Hex, eventHash } from "./hash";

describe("merkle", () => {
  it.each([1, 2, 3, 5, 8])("proves every leaf in a tree of %i", (count) => {
    const leaves = Array.from({ length: count }, (_, i) => sha256Hex(`leaf-${i}`));
    const { root, proofs } = buildMerkle(leaves);
    leaves.forEach((leaf, i) => expect(verifyMerkle(leaf, proofs[i], root)).toBe(true));
    expect(verifyMerkle(sha256Hex("tampered"), proofs[0], root)).toBe(false);
  });

  it("event hashes are independent of key order", () => {
    expect(eventHash(null, { a: 1, b: { c: 2, d: 3 } })).toBe(eventHash(null, { b: { d: 3, c: 2 }, a: 1 }));
  });
});
