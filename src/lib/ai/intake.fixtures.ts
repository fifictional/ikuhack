import type { Category, Severity } from "@/lib/domain/types";

/**
 * Realistic tenant reports with the answers we expect from intake.
 * Used by `npm run eval:intake` to compare prompts and models. Add a case
 * whenever Gemini gets something wrong in testing.
 */
export interface IntakeFixture {
  text: string;
  category: Category[];
  severity: Severity[];
  vulnerable: boolean;
  language: string;
  appliance?: string;
}

export const INTAKE_FIXTURES: IntakeFixture[] = [
  {
    text: "Black mould is spreading on the bedroom wall behind the bed and my 4 month old keeps coughing at night",
    category: ["damp_mould"], severity: ["significant", "emergency"], vulnerable: true, language: "en",
  },
  {
    text: "our dishwasher wont drain, theres dirty water sitting in the bottom since sunday",
    category: ["appliance"], severity: ["routine"], vulnerable: false, language: "en", appliance: "dishwasher",
  },
  {
    text: "Boiler stopped working yesterday, no heating or hot water. It's 2 degrees outside and my mum who lives with us is 84",
    category: ["heating_hot_water"], severity: ["emergency"], vulnerable: true, language: "en",
  },
  {
    text: "Strong smell of gas in the kitchen near the cooker",
    category: ["gas"], severity: ["emergency"], vulnerable: false, language: "en",
  },
  {
    text: "The front door lock is broken and I can't lock the flat when I go out",
    category: ["security"], severity: ["emergency", "significant"], vulnerable: false, language: "en",
  },
  {
    text: "Water drips through the bathroom ceiling every time the upstairs neighbours shower, the paint is bubbling",
    category: ["leak"], severity: ["significant"], vulnerable: false, language: "en",
  },
  {
    text: "W łazience na suficie i ścianach jest czarna pleśń, z każdym tygodniem jest jej więcej",
    category: ["damp_mould"], severity: ["significant"], vulnerable: false, language: "pl",
  },
  {
    text: "سخان الماء لا يعمل منذ ثلاثة أيام ولا يوجد ماء ساخن للاستحمام",
    category: ["heating_hot_water"], severity: ["significant", "emergency"], vulnerable: false, language: "ar",
  },
  {
    text: "Hay ratones en la cocina, los oímos por la noche y hay excrementos en los armarios",
    category: ["pest"], severity: ["significant"], vulnerable: false, language: "es",
  },
  {
    text: "Smoke alarm in the hallway keeps chirping even after I put a new battery in",
    category: ["smoke_co_alarm"], severity: ["significant", "emergency"], vulnerable: false, language: "en",
  },
  {
    text: "The socket in the living room sparks when I plug anything in, there's a burn mark on it",
    category: ["electrical"], severity: ["emergency"], vulnerable: false, language: "en",
  },
  {
    text: "Toilet won't flush at all and it's the only toilet in the flat",
    category: ["sanitation"], severity: ["significant", "emergency"], vulnerable: false, language: "en",
  },
  {
    text: "Fereastra din dormitor nu se mai închide bine și intră frig și apă când plouă",
    category: ["security", "structural", "leak"], severity: ["significant"], vulnerable: false, language: "ro",
  },
  {
    text: "kitchen cupboard door hinge is loose and the door hangs a bit",
    category: ["other", "structural"], severity: ["routine"], vulnerable: false, language: "en",
  },
];
