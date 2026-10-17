import { describe, expect, it } from "vitest";
import { preservesProtectedFacts, protectedTokens } from "./letter-polish";

const original =
  "You were notified on 17 October 2026. Please reply within 20 working days.\n[TENANT TO COMPLETE — name and date]";

describe("letter polish guard", () => {
  it("lists the dates, numbers and placeholders that must survive", () => {
    expect(protectedTokens(original)).toEqual(
      expect.arrayContaining(["17 October 2026", "17", "20", "2026", "[TENANT TO COMPLETE — name and date]"]),
    );
  });

  it("accepts a translated rewrite that keeps every protected token", () => {
    const translated = "Powiadomiono Cię 17 October 2026. Odpowiedz w ciągu 20 dni roboczych.\n[TENANT TO COMPLETE — name and date]";
    expect(preservesProtectedFacts(original, translated)).toBe(true);
  });

  it("rejects a rewrite that drops a date", () => {
    const dropped = "Please reply within 20 working days.\n[TENANT TO COMPLETE — name and date]";
    expect(preservesProtectedFacts(original, dropped)).toBe(false);
  });

  it("rejects a rewrite that turns a number into words", () => {
    const words = "You were notified on 17 October 2026. Please reply within twenty working days.\n[TENANT TO COMPLETE — name and date]";
    expect(preservesProtectedFacts(original, words)).toBe(false);
  });

  it("rejects a rewrite that drops a tenant placeholder", () => {
    const dropped = "You were notified on 17 October 2026. Please reply within 20 working days.";
    expect(preservesProtectedFacts(original, dropped)).toBe(false);
  });
});
