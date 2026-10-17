import { describe, expect, it } from "vitest";
import { assess, type Facts } from "./authenticity";

const base: Facts = {
  hashMatches: true,
  make: "Apple",
  model: "iPhone 15",
  capturedAt: new Date("2026-10-10T10:00:00Z"),
  modifiedAt: new Date("2026-10-10T10:00:00Z"),
  hasContentCredentials: false,
  uploadedAt: new Date("2026-10-10T10:05:00Z"),
  caseOpenedAt: new Date("2026-10-10T10:03:00Z"),
  reusedInCases: 0,
  visual: { suspicion: "none", signs: [], looksLikePhotoOfRealHome: true },
};

describe("photo authenticity", () => {
  it("passes a clean camera original", () => expect(assess(base).verdict).toBe("no_concerns"));
  it("can't clear a photo with no camera data", () =>
    expect(assess({ ...base, make: undefined, model: undefined, capturedAt: undefined, modifiedAt: undefined }).verdict).toBe("unverified"));
  it("flags a declared AI source", () =>
    expect(assess({ ...base, digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" }).verdict).toBe("likely_manipulated"));
  it("flags AI software names", () => expect(assess({ ...base, software: "Midjourney v6" }).verdict).toBe("likely_manipulated"));
  it("flags a file reused across cases", () => expect(assess({ ...base, reusedInCases: 1 }).verdict).toBe("likely_manipulated"));
  it("treats editor software as worth a look, not fraud", () => expect(assess({ ...base, software: "Adobe Photoshop 25" }).verdict).toBe("needs_review"));
  it("flags a modified-after-capture file", () =>
    expect(assess({ ...base, modifiedAt: new Date("2026-10-10T12:00:00Z") }).verdict).toBe("needs_review"));
  it("flags capture after upload", () =>
    expect(assess({ ...base, capturedAt: new Date("2026-10-11T10:00:00Z"), modifiedAt: undefined }).verdict).toBe("needs_review"));
  it("a visual 'high' alone asks for review rather than convicting", () =>
    expect(assess({ ...base, visual: { suspicion: "high", signs: ["cloned patch"], looksLikePhotoOfRealHome: false } }).verdict).toBe("needs_review"));
});
