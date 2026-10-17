import { describe, expect, it } from "vitest";
import type { CaseEvent, EventBody, Actor } from "@/lib/domain/types";
import { project } from "./project";
import { diff } from "./diff";
import { DEFAULT_LAW, withPhaseOverrides } from "./law";
import { addWorkingDays, londonYmd } from "./working-days";

let n = 0;
const ev = (at: string, actor: Actor, body: EventBody): CaseEvent =>
  ({ id: `e${++n}`, caseId: "c1", at, actor, ...body }) as CaseEvent;

const fact = (at: string, key: string, value: unknown, kind: string, label?: string): CaseEvent =>
  ev(at, "system", { type: "FACT_ASSERTED", key, value, source: { kind, label } } as EventBody);

const social = { landlordType: "social" as const, law: DEFAULT_LAW };
const ids = (s: ReturnType<typeof project>) => s.obligations.map((o) => o.id);

describe("working days", () => {
  it("skips Christmas, the Boxing Day substitute and the weekend", () => {
    const due = addWorkingDays(new Date("2026-12-24T10:00:00Z"), 1);
    expect(londonYmd(due)).toBe("2026-12-29");
  });
  it("ends at 23:59:59 London time during BST", () => {
    const due = addWorkingDays(new Date("2026-06-01T09:00:00Z"), 1);
    expect(due.toISOString()).toBe("2026-06-02T22:59:59.000Z");
  });
});

describe("adaptive reasoning", () => {
  it("dishwasher → structural leak: abandons the appliance duty and explains why", () => {
    const base = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "Dishwasher not draining", channel: "text" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "appliance", "tenant"),
      fact("2026-11-02T09:00:02Z", "appliance.suppliedByLandlord", true, "tenancy_agreement"),
      fact("2026-11-02T09:00:03Z", "issue.severity", "routine", "tenant"),
    ];
    const now = new Date("2026-11-03T12:00:00Z");
    const before = project("c1", base, { ...social, now });
    expect(ids(before)).toContain("contract.appliance_repair");

    const after = project(
      "c1",
      [
        ...base,
        fact("2026-11-03T10:00:00Z", "issue.category", "leak", "contractor", "AquaFix Ltd"),
        fact("2026-11-03T10:00:01Z", "issue.severity", "significant", "contractor", "AquaFix Ltd"),
      ],
      { ...social, now },
    );
    expect(ids(after)).not.toContain("contract.appliance_repair");
    expect(ids(after)).toContain("s11.repair");

    const revisions = diff(before, after);
    const dropped = revisions.find((r) => r.kind === "obligation_abandoned");
    expect(dropped?.summary).toMatch(/type of problem is now "leak"/);
  });

  it("sensor vs surveyor conflict on damp severity resolves safety-first", () => {
    const events = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "Black mould in bedroom", channel: "voice" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "damp_mould", "tenant"),
      fact("2026-11-04T09:00:00Z", "issue.severity", "routine", "surveyor", "Surveyor visit"),
      fact("2026-11-05T09:00:00Z", "hazard.dampPersistent", true, "sensor", "Bedroom humidity sensor"),
    ];
    const s = project("c1", events, { ...social, now: new Date("2026-11-05T10:00:00Z") });
    expect(s.facts["issue.severity"]?.value).toBe("significant");
    expect(s.conflicts[0]?.resolution).toBe("safety_first");
    expect(ids(s)).toContain("awaab.investigate");
  });

  it("vulnerable occupant turns significant damp into a 24h emergency", () => {
    const base = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "Mould spreading", channel: "voice" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "damp_mould", "tenant"),
      fact("2026-11-02T09:00:02Z", "issue.severity", "significant", "tenant"),
    ];
    const now = new Date("2026-11-02T12:00:00Z");
    const before = project("c1", base, { ...social, now });
    const after = project("c1", [...base, fact("2026-11-02T11:00:00Z", "household.vulnerable", true, "tenant")], {
      ...social,
      now,
    });
    expect(ids(before)).toContain("awaab.investigate");
    expect(ids(after)).toContain("awaab.emergency");
    expect(ids(after)).not.toContain("awaab.investigate");
  });

  it("tenant missing an appointment pauses the landlord's clock", () => {
    const events = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "Boiler broken", channel: "text" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "heating_hot_water", "tenant"),
      fact("2026-11-02T09:00:02Z", "issue.severity", "significant", "tenant"),
      { ...ev("2026-11-02T10:00:00Z", "landlord", { type: "ACCESS_PROPOSED", slotStart: "2026-11-04T09:00:00Z" }), id: "p1" },
      ev("2026-11-04T09:30:00Z", "contractor", { type: "ACCESS_OUTCOME", proposalId: "p1", outcome: "tenant_no_access" }),
      ev("2026-11-06T09:00:00Z", "landlord", { type: "ACCESS_PROPOSED", slotStart: "2026-11-09T09:00:00Z" }),
    ] as CaseEvent[];
    const s = project("c1", events, { ...social, now: new Date("2026-11-07T09:00:00Z") });
    const repair = s.obligations.find((o) => o.id === "s11.repair")!;
    expect(repair.pausedMs).toBe(2 * 24 * 3_600_000);
    expect(s.obligations.find((o) => o.id === "tenant.allow_access:p1")?.status).toBe("breached");
  });

  it("a law commencing re-classifies an open case", () => {
    const events = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "No heating", channel: "text" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "heating_hot_water", "tenant"),
      fact("2026-11-02T09:00:02Z", "issue.severity", "significant", "surveyor"),
    ];
    const now = new Date("2026-11-03T09:00:00Z");
    const before = project("c1", events, { ...social, now });
    const law = withPhaseOverrides(DEFAULT_LAW, { "awaab-2": "2026-11-03" });
    const after = project("c1", events, { landlordType: "social", law, now });
    expect(ids(before)).not.toContain("awaab.investigate");
    expect(ids(after)).toContain("awaab.investigate");
    expect(diff(before, after).some((r) => r.kind === "obligation_added" && r.obligationId === "awaab.investigate")).toBe(true);
  });

  it("disputed fix reopens the repair duty", () => {
    const events = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "Leak", channel: "text" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "leak", "tenant"),
      fact("2026-11-02T09:00:02Z", "issue.severity", "significant", "tenant"),
      ev("2026-11-04T09:00:00Z", "contractor", { type: "WORKS_COMPLETED" }),
      ev("2026-11-05T09:00:00Z", "tenant", { type: "TENANT_DISPUTED_FIX", reason: "Still dripping" }),
    ];
    const s = project("c1", events, { ...social, now: new Date("2026-11-06T09:00:00Z") });
    expect(s.obligations.find((o) => o.id === "s11.repair")?.status).toBe("open");
  });

  describe("photo check of the fix", () => {
    const base = [
      ev("2026-11-02T09:00:00Z", "tenant", { type: "REPORTED", description: "Mould on bathroom ceiling", channel: "photo" }),
      fact("2026-11-02T09:00:01Z", "issue.category", "damp_mould", "tenant"),
      fact("2026-11-02T09:00:02Z", "issue.severity", "significant", "surveyor"),
      ev("2026-11-05T09:00:00Z", "contractor", { type: "WORKS_COMPLETED", notes: "Treated and painted" }),
    ];
    const now = new Date("2026-11-05T12:00:00Z");
    const photoCheck = (at: string, value: boolean, confidence: number) =>
      ev(at, "system", {
        type: "FACT_ASSERTED",
        key: "fix.verified",
        value,
        source: { kind: "ai_vision", label: "Gemini photo check" },
        confidence,
        note: "mould still visible in the corner above the shower",
      } as EventBody);

    it("a confident 'not fixed' outweighs the contractor and reopens the duty", () => {
      const before = project("c1", base, { ...social, now });
      expect(before.obligations.find((o) => o.id === "s9a.fitness")?.status).toBe("met");

      const after = project("c1", [...base, photoCheck("2026-11-05T10:00:00Z", false, 0.9)], { ...social, now });
      expect(after.obligations.find((o) => o.id === "s9a.fitness")?.status).toBe("open");
      expect(after.conflicts.find((c) => c.key === "fix.verified")?.resolution).toBe("safety_first");
      expect(after.notes.join(" ")).toMatch(/mould still visible/);
      expect(after.phase).not.toBe("fixed_pending_confirmation");
      expect(diff(before, after).some((r) => r.kind === "obligation_reopened" && r.obligationId === "s9a.fitness")).toBe(true);
    });

    it("an unsure photo check doesn't override the contractor", () => {
      const s = project("c1", [...base, photoCheck("2026-11-05T10:00:00Z", false, 0.4)], { ...social, now });
      expect(s.obligations.find((o) => o.id === "s9a.fitness")?.status).toBe("met");
    });

    it("the tenant confirming it's fixed outranks the AI", () => {
      const s = project(
        "c1",
        [...base, photoCheck("2026-11-05T10:00:00Z", false, 0.9), ev("2026-11-05T11:00:00Z", "tenant", { type: "TENANT_CONFIRMED_FIXED" })],
        { ...social, now },
      );
      expect(s.facts["fix.verified"]?.value).toBe(true);
      expect(s.phase).toBe("resolved");
    });

    it("an old 'not fixed' check doesn't block a later re-fix", () => {
      const s = project(
        "c1",
        [
          ...base,
          photoCheck("2026-11-05T10:00:00Z", false, 0.9),
          ev("2026-11-05T11:00:00Z", "contractor", { type: "WORKS_COMPLETED", notes: "Second visit" }),
        ],
        { ...social, now },
      );
      expect(s.obligations.find((o) => o.id === "s9a.fitness")?.status).toBe("met");
    });
  });

  describe("verified law (sources.ts)", () => {
    const heating = [
      ev("2026-12-01T09:00:00Z", "tenant", { type: "REPORTED", description: "No heating", channel: "text" }),
      fact("2026-12-01T09:00:01Z", "issue.category", "heating_hot_water", "tenant"),
      fact("2026-12-01T09:00:02Z", "issue.severity", "significant", "surveyor"),
    ];

    it("Awaab's Law Phase 2 (excess cold) applies from 30 November 2026 with no override", () => {
      const before = project("c1", heating, { ...social, now: new Date("2026-11-29T12:00:00Z") });
      const after = project("c1", heating, { ...social, now: new Date("2026-12-01T12:00:00Z") });
      expect(ids(before)).not.toContain("awaab.investigate");
      expect(ids(after)).toContain("awaab.investigate");
    });

    it("a broken lock (entry by intruders) is not a Phase 2 significant hazard", () => {
      const lock = [
        ev("2026-12-01T09:00:00Z", "tenant", { type: "REPORTED", description: "Front door lock broken", channel: "text" }),
        fact("2026-12-01T09:00:01Z", "issue.category", "security", "tenant"),
        fact("2026-12-01T09:00:02Z", "issue.severity", "significant", "surveyor"),
      ];
      expect(ids(project("c1", lock, { ...social, now: new Date("2026-12-02T12:00:00Z") }))).not.toContain("awaab.investigate");
    });

    it("only fixed statutory periods are called legal deadlines", () => {
      const s = project("c1", heating, { ...social, now: new Date("2026-12-01T12:00:00Z") });
      const repair = s.obligations.find((o) => o.id === "s11.repair")!;
      const awaab = s.obligations.find((o) => o.id === "awaab.investigate")!;
      expect(repair.legalBasis).toMatchObject({ statutory: true, deadline: "target", sourceId: "lta1985_s11" });
      expect(awaab.legalBasis).toMatchObject({ statutory: true, deadline: "law", sourceId: "awaab_regs_2025" });
      expect(awaab.legalBasis.url).toMatch(/legislation\.gov\.uk\/uksi\/2025\/1042/);
    });
  });
});
