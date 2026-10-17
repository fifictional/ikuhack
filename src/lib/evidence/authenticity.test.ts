import { describe, expect, it } from "vitest";
import { assess, type Facts } from "./authenticity";

const clean: Facts = { visual: { suspicion: "none", signs: [], looksLikePhotoOfRealHome: true } };

describe("photo AI/edit check", () => {
  it("passes a clean photo", () => expect(assess(clean).verdict).toBe("looks_real"));
  it("passes when metadata is simply missing", () => expect(assess({ ...clean, software: undefined }).verdict).toBe("looks_real"));
  it("flags a declared AI source", () =>
    expect(assess({ ...clean, digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" }).verdict).toBe("likely_ai_or_edited"));
  it("flags AI software names", () => expect(assess({ ...clean, software: "Midjourney v6" }).verdict).toBe("likely_ai_or_edited"));
  it("treats editor software as worth a look, not fraud", () => expect(assess({ ...clean, software: "Adobe Photoshop 25" }).verdict).toBe("needs_review"));
  it("a visual 'high' alone asks for review rather than convicting", () =>
    expect(assess({ visual: { suspicion: "high", signs: ["cloned patch"], looksLikePhotoOfRealHome: false } }).verdict).toBe("needs_review"));
  it("a visual 'high' backed by editor software is likely edited", () =>
    expect(assess({ software: "Photoshop", visual: { suspicion: "high", signs: ["cloned patch"], looksLikePhotoOfRealHome: false } }).verdict).toBe("likely_ai_or_edited"));
  it("says 'not checked' rather than pass when the picture check is unavailable", () => expect(assess({}).verdict).toBe("not_checked"));
});
