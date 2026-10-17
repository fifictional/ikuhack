import { describe, expect, it } from "vitest";
import { complianceDuties, type ComplianceProperty, type ComplianceRecord } from "./duties";

const property: ComplianceProperty = { id: "p1", address: "1 Test Street", postcode: "E1 1AA", landlordType: "social" };
const at = (iso: string) => new Date(iso);

const record = (over: Partial<ComplianceRecord> = {}): ComplianceRecord => ({
  id: "r1",
  propertyId: "p1",
  kind: "gas_safety",
  performedAt: "2025-01-15T00:00:00.000Z",
  copySentAt: "2025-01-20T00:00:00.000Z",
  ...over,
});

describe("complianceDuties", () => {
  it("flags a missing gas safety record as a breach", () => {
    const duties = complianceDuties([property], [], at("2025-06-01T00:00:00.000Z"));
    const missing = duties.find((d) => d.kind === "gas_safety" && d.title.startsWith("No "));
    expect(missing?.status).toBe("breached");
  });

  it("puts the next gas check 12 months after the inspection", () => {
    const duties = complianceDuties([property], [record()], at("2025-06-01T00:00:00.000Z"));
    const check = duties.find((d) => d.id.endsWith(":check"));
    expect(check?.dueAt).toBe("2026-01-15T00:00:00.000Z");
    expect(check?.status).toBe("open");
  });

  it("breaches the gas check once the 12 months have passed", () => {
    const duties = complianceDuties([property], [record()], at("2026-02-01T00:00:00.000Z"));
    expect(duties.find((d) => d.id.endsWith(":check"))?.status).toBe("breached");
  });

  it("marks the 28-day copy met when sent", () => {
    const duties = complianceDuties([property], [record()], at("2025-06-01T00:00:00.000Z"));
    expect(duties.find((d) => d.id.endsWith(":copy"))?.status).toBe("met");
  });

  it("breaches the 28-day copy when it was never sent", () => {
    const duties = complianceDuties([property], [record({ copySentAt: null })], at("2025-06-01T00:00:00.000Z"));
    const copy = duties.find((d) => d.id.endsWith(":copy"));
    expect(copy?.status).toBe("breached");
    expect(copy?.dueAt).toBe("2025-02-12T00:00:00.000Z");
  });

  it("keeps the copy open inside the 28-day window", () => {
    const duties = complianceDuties([property], [record({ copySentAt: null })], at("2025-01-25T00:00:00.000Z"));
    expect(duties.find((d) => d.id.endsWith(":copy"))?.status).toBe("open");
  });

  it("uses a 5-year cycle for EICR", () => {
    const eicr = record({ id: "r2", kind: "eicr", performedAt: "2021-03-01T00:00:00.000Z", copySentAt: "2021-03-10T00:00:00.000Z" });
    const duties = complianceDuties([property], [eicr], at("2026-02-01T00:00:00.000Z"));
    expect(duties.find((d) => d.id.includes(":eicr:check"))?.dueAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("uses the latest inspection and clamps month-end dates", () => {
    const older = record({ id: "old", performedAt: "2023-01-31T00:00:00.000Z" });
    const latest = record({ id: "new", performedAt: "2025-01-31T00:00:00.000Z" });
    const duties = complianceDuties([property], [older, latest], at("2025-06-01T00:00:00.000Z"));
    expect(duties.find((d) => d.id.endsWith(":check"))?.dueAt).toBe("2026-01-31T00:00:00.000Z");
  });

  it("sorts breaches first", () => {
    const duties = complianceDuties([property], [], at("2025-06-01T00:00:00.000Z"));
    expect(duties[0].status).toBe("breached");
  });
});
