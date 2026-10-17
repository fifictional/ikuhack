/**
 * Register of every legal source Docket's rules rely on, each checked against an official
 * publication (legislation.gov.uk, gov.uk, justice.gov.uk). Rules cite these by id, the UI
 * links to `url`, and the reasoning graph draws them as law nodes.
 *
 * To add a rule: add (or reuse) a source here, record what you checked and when, then cite it
 * in law.ts / rules.ts. Never cite something that isn't in this register.
 */

export type SourceKind = "statute" | "regulations" | "protocol" | "case_law" | "guidance";

export interface LegalSource {
  id: string;
  kind: SourceKind;
  /** Short name for UI and graph labels. */
  short: string;
  citation: string;
  url: string;
  /** What the rules take from this source, in plain words. */
  provides: string;
  verified: {
    on: string;
    /** What was checked against the official text. */
    what: string;
    /** Anything not yet confirmed, or caveats a lawyer should know. */
    caveat?: string;
  };
  /** Other sources this one inserts into / amends / is made under (graph edges). */
  linksTo?: { id: string; relation: "inserted_by" | "made_under" | "amended_by" | "interprets" | "extends" }[];
}

const CHECKED = "2026-10-17";

export const LEGAL_SOURCES = {
  lta1985_s11: {
    id: "lta1985_s11",
    kind: "statute",
    short: "LTA 1985 s11",
    citation: "Landlord and Tenant Act 1985, s11 (repairing obligations in short leases)",
    url: "https://www.legislation.gov.uk/ukpga/1985/70/section/11",
    provides: "Landlord must keep in repair the structure and exterior, and installations for water, gas, electricity, sanitation, space heating and hot water.",
    verified: {
      on: CHECKED,
      what: "s11(1) scope of the repairing covenant; s11(6) entry to view on 24 hours' written notice.",
      caveat: "Applies to leases within ss13–14 (broadly, terms under 7 years). The time to repair is a 'reasonable time' after notice (case law), so Docket's deadlines here are service targets, not statutory periods.",
    },
  },
  lta1985_s9a: {
    id: "lta1985_s9a",
    kind: "statute",
    short: "LTA 1985 s9A",
    citation: "Landlord and Tenant Act 1985, s9A (fitness for human habitation)",
    url: "https://www.legislation.gov.uk/ukpga/1985/70/section/9A",
    provides: "Landlord must keep the dwelling fit for human habitation throughout the tenancy; not liable for unfitness caused by the tenant's breach.",
    verified: {
      on: CHECKED,
      what: "Implied covenant on fitness; tenant-caused exception; inserted by the Homes (Fitness for Human Habitation) Act 2018 with effect from 20 March 2019.",
      caveat: "Scope set by s9B. No statutory timescale; Docket's deadlines here are service targets.",
    },
    linksTo: [{ id: "hfhh_act_2018", relation: "inserted_by" }],
  },
  hfhh_act_2018: {
    id: "hfhh_act_2018",
    kind: "statute",
    short: "Homes (FHH) Act 2018",
    citation: "Homes (Fitness for Human Habitation) Act 2018",
    url: "https://www.legislation.gov.uk/ukpga/2018/34",
    provides: "Inserted s9A into the Landlord and Tenant Act 1985.",
    verified: { on: CHECKED, what: "Confirmed as the inserting Act on the s9A page (ss1(3), 2(2))." },
  },
  lta1985_s10a: {
    id: "lta1985_s10a",
    kind: "statute",
    short: "LTA 1985 s10A (Awaab's Law)",
    citation: "Landlord and Tenant Act 1985, s10A (social housing: hazards), inserted by the Social Housing (Regulation) Act 2023 s42",
    url: "https://www.legislation.gov.uk/ukpga/1985/70/section/10A",
    provides: "Implied covenant in social housing leases to comply with prescribed requirements on hazards; 'all reasonable endeavours' defence.",
    verified: { on: CHECKED, what: "Applies to relevant social housing leases in England; in force from 20 September 2023; enforced as a breach of covenant." },
    linksTo: [{ id: "shr_act_2023", relation: "inserted_by" }],
  },
  shr_act_2023: {
    id: "shr_act_2023",
    kind: "statute",
    short: "Social Housing (Regulation) Act 2023",
    citation: "Social Housing (Regulation) Act 2023, s42",
    url: "https://www.legislation.gov.uk/ukpga/2023/36/section/42",
    provides: "Inserted ss10A–10B into the Landlord and Tenant Act 1985.",
    verified: { on: CHECKED, what: "Confirmed as the inserting provision on the s10A page." },
  },
  awaab_regs_2025: {
    id: "awaab_regs_2025",
    kind: "regulations",
    short: "Awaab's Law Regs 2025",
    citation: "Hazards in Social Housing (Prescribed Requirements) (England) Regulations 2025 (SI 2025/1042)",
    url: "https://www.legislation.gov.uk/uksi/2025/1042/contents/made",
    provides:
      "Emergency hazards: act within 24 hours (reg 5). Significant hazards: investigate within 10 working days (reg 6), written summary within 3 working days (reg 9), begin safety work within 5 working days (reg 11) of the investigation. Working days exclude weekends, Christmas Day, Good Friday and bank holidays (reg 2).",
    verified: {
      on: CHECKED,
      what: "Regs 2, 3, 5, 6, 9 and 11 read on legislation.gov.uk. Phase 1 covers significant hazards from damp and mould, and emergency hazards of every prescribed kind except lack of space (reg 3). Periods start the day after the trigger.",
      caveat: "Reg 5's 24 hours runs from when an emergency is suspected or confirmed; Docket starts it at the report. Part 6 (temporary rehousing) can alter deadlines and isn't modelled.",
    },
    linksTo: [{ id: "lta1985_s10a", relation: "made_under" }],
  },
  awaab_phase2_guidance: {
    id: "awaab_phase2_guidance",
    kind: "guidance",
    short: "Awaab's Law Phase 2 guidance",
    citation: "MHCLG, Awaab's Law Phase 2: Guidance for social landlords",
    url: "https://www.gov.uk/government/publications/awaabs-law-phase-2-guidance-for-social-housing-landlords/awaabs-law-phase-2-guidance-for-social-landlords",
    provides:
      "From 30 November 2026, significant-hazard duties extend to excess cold, excess heat, falls, structural collapse, fire and explosions, electrical hazards and domestic hygiene (including personal hygiene and food safety). Same timescales.",
    verified: {
      on: CHECKED,
      what: "Hazard list and 30 November 2026 date from the gov.uk guidance; draft amending regulations laid 13 July 2026.",
      caveat: "Amending regulations are 'subject to Parliamentary approval': confirm they've been made before relying on Phase 2 after 30 November 2026.",
    },
    linksTo: [{ id: "awaab_regs_2025", relation: "extends" }],
  },
  alarm_regs: {
    id: "alarm_regs",
    kind: "regulations",
    short: "Smoke & CO Alarm Regs",
    citation: "Smoke and Carbon Monoxide Alarm (England) Regulations 2015 (SI 2015/1693) reg 4, as amended by SI 2022/707",
    url: "https://www.legislation.gov.uk/uksi/2015/1693/regulation/4",
    provides: "When told an alarm is faulty, the landlord must check and repair or replace it as soon as reasonably practicable (reg 4(1)(c), 4(3A)).",
    verified: {
      on: CHECKED,
      what: "Reg 4(1)(c) and (3A), inserted by SI 2022/707 from 1 October 2022.",
      caveat: "'As soon as reasonably practicable' has no fixed period; Docket uses a 24h target. Coverage of social tenancies depends on the Schedule to the 2015 Regulations as amended: confirm before pitching it for social homes.",
    },
  },
  gas_safety_regs_1998: {
    id: "gas_safety_regs_1998",
    kind: "regulations",
    short: "Gas Safety Regs 1998",
    citation: "Gas Safety (Installation and Use) Regulations 1998 (SI 1998/2451), reg 36",
    url: "https://www.legislation.gov.uk/uksi/1998/2451/regulation/36/made",
    provides:
      "A landlord must have every gas appliance and flue checked by a Gas Safe registered engineer at least every 12 months, keep the record for 2 years, and give the tenant a copy within 28 days of the check.",
    verified: {
      on: CHECKED,
      what: "Annual check, 2-year record retention and 28-day copy taken from reg 36.",
      caveat: "Re-confirm the reg 36 wording and the copy deadline on legislation.gov.uk before the pitch.",
    },
  },
  eicr_regs_2020: {
    id: "eicr_regs_2020",
    kind: "regulations",
    short: "EICR Regs 2020",
    citation: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020 (SI 2020/312), reg 3",
    url: "https://www.legislation.gov.uk/uksi/2020/312/regulation/3/made",
    provides:
      "The electrical installation must be inspected and tested at least every 5 years by a qualified person, and the tenant must be given a copy of the report within 28 days of the inspection.",
    verified: {
      on: CHECKED,
      what: "5-year inspection cycle and 28-day copy taken from reg 3.",
      caveat: "These Regulations apply to the private rented sector in England; social landlords have a separate regime. Re-confirm the reg numbers before the pitch.",
    },
  },
  pap_housing: {
    id: "pap_housing",
    kind: "protocol",
    short: "Pre-Action Protocol (Housing Conditions)",
    citation: "Pre-Action Protocol for Housing Conditions Claims (England)",
    url: "https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/prot_hou",
    provides:
      "Letter of claim contents (para 5.2); landlord should normally reply within 20 working days of receipt (receipt deemed 2 days after the letter's date); single joint expert if the landlord doesn't object.",
    verified: { on: CHECKED, what: "Title, 20 working day response, letter contents, and single joint expert (para 7.2)." },
  },
  warren_v_keen: {
    id: "warren_v_keen",
    kind: "case_law",
    short: "Warren v Keen",
    citation: "Warren v Keen [1954] 1 QB 15 (CA)",
    url: "https://en.wikipedia.org/wiki/Warren_v_Keen",
    provides: "A tenant must use the property in a 'tenant-like manner' and isn't liable for fair wear and tear or causes not attributable to them.",
    verified: {
      on: CHECKED,
      what: "Citation and principle confirmed via case summaries.",
      caveat: "Link is a summary; cite the law report ([1954] 1 QB 15) in any formal letter.",
    },
  },
  lsa_2007_s12: {
    id: "lsa_2007_s12",
    kind: "statute",
    short: "Legal Services Act 2007 s12",
    citation: "Legal Services Act 2007, s12 (reserved legal activities)",
    url: "https://www.legislation.gov.uk/ukpga/2007/29/section/12",
    provides: "The conduct of litigation is a reserved legal activity, so Docket drafts documents for the tenant but never conducts litigation.",
    verified: { on: CHECKED, what: "s12(1)(b) lists 'the conduct of litigation'." },
  },
  bank_holidays: {
    id: "bank_holidays",
    kind: "guidance",
    short: "UK bank holidays",
    citation: "GOV.UK bank holidays (England and Wales)",
    url: "https://www.gov.uk/bank-holidays.json",
    provides: "Dates excluded from working-day deadlines.",
    verified: { on: CHECKED, what: "All 2025–2027 England & Wales dates in working-days.ts match the feed exactly." },
  },
} satisfies Record<string, LegalSource>;

export type SourceId = keyof typeof LEGAL_SOURCES;

export const source = (id: SourceId): LegalSource => LEGAL_SOURCES[id];
