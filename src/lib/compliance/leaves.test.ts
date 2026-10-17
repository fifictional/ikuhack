import { describe, expect, it } from "vitest";
import { copyLeaf, recordLeaf } from "./leaves";

const rec = { id: "r1", propertyId: "p1", kind: "gas_safety", performedAt: "2026-01-05T09:00:00.000Z", certificateSha256: null };

describe("compliance anchor leaves", () => {
  it("is deterministic and accepts Date or ISO input", () => {
    expect(recordLeaf(rec)).toBe(recordLeaf({ ...rec, performedAt: new Date(rec.performedAt) }));
    expect(recordLeaf(rec)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes if any field is altered, including the date", () => {
    const base = recordLeaf(rec);
    expect(recordLeaf({ ...rec, performedAt: "2026-01-06T09:00:00.000Z" })).not.toBe(base);
    expect(recordLeaf({ ...rec, kind: "eicr" })).not.toBe(base);
    expect(recordLeaf({ ...rec, certificateSha256: "a".repeat(64) })).not.toBe(base);
  });
  it("the copy timestamp is its own leaf and can't collide with the record", () => {
    const copy = copyLeaf({ id: "r1", copySentAt: "2026-01-20T10:00:00.000Z" });
    expect(copy).not.toBe(recordLeaf(rec));
    expect(copy).not.toBe(copyLeaf({ id: "r1", copySentAt: "2026-01-21T10:00:00.000Z" }));
  });
});
