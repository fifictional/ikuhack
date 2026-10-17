import type { Category, LandlordType, Severity } from "@/lib/domain/types";
import type { SourceId } from "./sources";

/**
 * Every legal number and commencement date lives here. Each is traced to an entry in sources.ts,
 * which records the official URL and what was checked (last full check: 17 Oct 2026).
 * The LLM never produces these values.
 */

/** HHSRS hazards (Housing Health and Safety Rating System, Housing Act 2004) we map categories onto. */
export type Hazard =
  | "damp_mould"
  | "excess_cold"
  | "excess_heat"
  | "falls"
  | "electrical"
  | "explosions"
  | "carbon_monoxide"
  | "fire"
  | "structural_collapse"
  | "entry_by_intruders"
  | "domestic_hygiene_pests"
  | "personal_hygiene_sanitation"
  | "water_supply";

export const CATEGORY_HAZARDS: Record<Category, Hazard[]> = {
  damp_mould: ["damp_mould"],
  leak: ["water_supply", "damp_mould"],
  heating_hot_water: ["excess_cold"],
  electrical: ["electrical"],
  gas: ["explosions", "carbon_monoxide"],
  sanitation: ["personal_hygiene_sanitation"],
  structural: ["structural_collapse"],
  security: ["entry_by_intruders"],
  pest: ["domestic_hygiene_pests"],
  smoke_co_alarm: ["fire", "carbon_monoxide"],
  appliance: [],
  other: [],
};

/** Landlord and Tenant Act 1985 s11 — structure/exterior and installations. */
export const S11_CATEGORIES: Category[] = [
  "leak",
  "heating_hot_water",
  "electrical",
  "gas",
  "sanitation",
  "structural",
  "security",
];

/** Fitness for human habitation (LTA 1985 s9A, inserted by the 2018 Act) — HHSRS hazards. */
export const S9A_CATEGORIES: Category[] = ["damp_mould", "pest"];

export interface AwaabPhase {
  id: string;
  label: string;
  /** ISO date the phase came/comes into force; null = not yet fixed. */
  commencesAt: string | null;
  hazards: Hazard[] | "all";
  severities: Severity[];
  appliesTo: LandlordType[];
  /** Where this phase's scope and date come from (sources.ts). */
  sourceIds: SourceId[];
  /** Caveat to surface, e.g. "subject to Parliamentary approval". */
  status?: string;
}

export interface LawConfig {
  awaabPhases: AwaabPhase[];
}

/** SI 2025/1042: reg 5 (24h), reg 6 (10 working days), reg 9 (3), reg 11 (5). Verified on legislation.gov.uk. */
export const AWAAB = {
  citation: "Awaab's Law: LTA 1985 s10A; Hazards in Social Housing (Prescribed Requirements) (England) Regulations 2025 (SI 2025/1042)",
  url: "https://www.legislation.gov.uk/uksi/2025/1042/contents/made",
  emergencyHours: 24,
  investigateWorkingDays: 10,
  summaryWorkingDays: 3,
  startWorksWorkingDays: 5,
};

export const DEFAULT_LAW: LawConfig = {
  awaabPhases: [
    {
      id: "awaab-1-damp",
      label: "Awaab's Law phase 1 — damp & mould",
      commencesAt: "2025-10-27",
      hazards: ["damp_mould"],
      severities: ["significant", "emergency"],
      appliesTo: ["social"],
      sourceIds: ["awaab_regs_2025", "lta1985_s10a"],
    },
    {
      id: "awaab-1-emergency",
      label: "Awaab's Law phase 1 — all emergency hazards",
      commencesAt: "2025-10-27",
      hazards: "all",
      severities: ["emergency"],
      appliesTo: ["social"],
      sourceIds: ["awaab_regs_2025", "lta1985_s10a"],
    },
    {
      id: "awaab-2",
      label: "Awaab's Law phase 2 — wider HHSRS hazards",
      // gov.uk Phase 2 guidance: excess cold, excess heat, falls, structural collapse, fire and explosions,
      // electrical hazards, domestic hygiene (incl. personal hygiene and food safety).
      commencesAt: "2026-11-30",
      hazards: [
        "excess_cold",
        "excess_heat",
        "falls",
        "structural_collapse",
        "explosions",
        "fire",
        "electrical",
        "domestic_hygiene_pests",
        "personal_hygiene_sanitation",
      ],
      severities: ["significant", "emergency"],
      appliesTo: ["social"],
      sourceIds: ["awaab_phase2_guidance", "awaab_regs_2025"],
      status: "Amending regulations subject to Parliamentary approval (laid 13 July 2026).",
    },
    {
      id: "awaab-private",
      label: "Awaab's Law extended to private rented sector (Renters' Rights Act 2025)",
      commencesAt: null,
      hazards: ["damp_mould"],
      severities: ["significant", "emergency"],
      appliesTo: ["private"],
      sourceIds: ["lta1985_s10a"],
      status: "Not in force: extension to private renting is still at consultation stage, so no commencement date.",
    },
  ],
};

/** Docket service targets for "reasonable time" duties. NOT statutory — label them as targets in the UI. */
export const DOCKET_TARGETS = {
  emergencyHours: 24,
  significantWorkingDays: 10,
  routineCalendarDays: 28,
  acknowledgeWorkingDays: 1,
};

/** LTA 1985 s11(6): landlord must give 24 hours' written notice to enter to view condition. */
export const ACCESS_NOTICE_HOURS = 24;

/** Pre-Action Protocol for Housing Conditions Claims (England): landlord responds within 20 working days. */
export const PRE_ACTION_RESPONSE_WORKING_DAYS = 20;

export function withPhaseOverrides(law: LawConfig, overrides: Record<string, string | null>): LawConfig {
  return {
    awaabPhases: law.awaabPhases.map((p) => (p.id in overrides ? { ...p, commencesAt: overrides[p.id] } : p)),
  };
}

/** The Awaab phase (if any) that covers this hazard/severity for this landlord at `now`. */
export function applicableAwaabPhase(
  law: LawConfig,
  landlordType: LandlordType,
  category: Category,
  severity: Severity,
  now: Date,
): AwaabPhase | undefined {
  const hazards = CATEGORY_HAZARDS[category];
  return law.awaabPhases.find(
    (p) =>
      p.commencesAt !== null &&
      new Date(p.commencesAt).getTime() <= now.getTime() &&
      p.appliesTo.includes(landlordType) &&
      p.severities.includes(severity) &&
      (p.hazards === "all" ? hazards.length > 0 : hazards.some((h) => (p.hazards as Hazard[]).includes(h))),
  );
}
