import { LEGAL_SOURCES, type LegalSource } from "@/lib/engine/sources";

/**
 * A render-ready view of the legal knowledge graph.
 *
 * Verified sources come from `src/lib/engine/sources.ts` — the register the
 * engine cites via `LegalBasis.sourceId`, so those ids MUST stay stable. On top
 * of them we add requirement and HHSRS hazard nodes plus relevance links, which
 * makes the graph a network rather than a flat list of sources.
 *
 * Swap the /api/law/graph route for a Neo4j query later and the UI is unchanged.
 */

export type LawNodeKind =
  | "statute"
  | "section"
  | "regulation"
  | "requirement"
  | "case"
  | "protocol"
  | "standard"
  | "hazard"
  | "guidance";

export interface LawNode {
  id: string;
  kind: LawNodeKind;
  title: string;
  citation: string;
  /** The actual point taken from the document, in plain words. */
  excerpt: string;
  /** Link to the primary source. Empty = internal. */
  url: string;
}

export interface LawEdge {
  from: string;
  to: string;
  label: string;
}

export interface LawGraph {
  nodes: LawNode[];
  edges: LawEdge[];
}

const SOURCE_KIND: Record<LegalSource["kind"], LawNodeKind> = {
  statute: "statute",
  regulations: "regulation",
  protocol: "protocol",
  case_law: "case",
  guidance: "guidance",
};

const sourceNodes: LawNode[] = (Object.values(LEGAL_SOURCES) as LegalSource[]).map((s) => ({
  id: s.id,
  kind: SOURCE_KIND[s.kind],
  title: s.short,
  citation: s.citation,
  excerpt: s.provides,
  url: s.url,
}));

const GOV = (path: string) => `https://www.legislation.gov.uk/${path}`;
const AWAAB_URL = "https://www.legislation.gov.uk/uksi/2025/1042/contents/made";
const HHSRS = "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system";

/** The enforceable points inside the sources — this is what the graph draws in terracotta. */
const requirementNodes: LawNode[] = [
  {
    id: "req_s9a_fitness",
    kind: "requirement",
    title: "Home fit for human habitation",
    citation: "LTA 1985 s9A",
    excerpt: "Fix the cause so the home is fit to live in — a continuing duty while the hazard affects the tenant.",
    url: GOV("ukpga/1985/70/section/9A"),
  },
  {
    id: "req_s11_repair",
    kind: "requirement",
    title: "Repair within a reasonable time",
    citation: "LTA 1985 s11",
    excerpt: "Once given notice, the landlord must carry out the repair within a reasonable time of the tenant's report.",
    url: GOV("ukpga/1985/70/section/11"),
  },
  {
    id: "req_s11_6_access",
    kind: "requirement",
    title: "24 hours' written notice to enter",
    citation: "LTA 1985 s11(6)",
    excerpt: "The landlord can only enter to inspect or repair with at least 24 hours' written notice (unless it's an emergency).",
    url: GOV("ukpga/1985/70/section/11"),
  },
  {
    id: "req_awaab_investigate",
    kind: "requirement",
    title: "Investigate within 10 working days",
    citation: "Awaab's Law Regs 2025, reg 6",
    excerpt: "A social landlord must investigate a reported significant hazard within 10 working days of becoming aware of it.",
    url: AWAAB_URL,
  },
  {
    id: "req_awaab_summary",
    kind: "requirement",
    title: "Written summary within 3 working days",
    citation: "Awaab's Law Regs 2025, reg 9",
    excerpt: "Within 3 working days of the investigation, the landlord must send the tenant a written summary of the findings.",
    url: AWAAB_URL,
  },
  {
    id: "req_awaab_works",
    kind: "requirement",
    title: "Begin safety works within 5 working days",
    citation: "Awaab's Law Regs 2025, reg 11",
    excerpt: "Safety works must begin within 5 working days of the investigation concluding.",
    url: AWAAB_URL,
  },
  {
    id: "req_awaab_emergency",
    kind: "requirement",
    title: "Make safe within 24 hours",
    citation: "Awaab's Law Regs 2025, reg 5",
    excerpt: "For an emergency hazard, the landlord must investigate and make the home safe within 24 hours.",
    url: AWAAB_URL,
  },
  {
    id: "req_alarm_repair",
    kind: "requirement",
    title: "Repair or replace faulty alarms",
    citation: "Smoke & CO Alarm Regs 2022",
    excerpt: "When a tenant reports a faulty alarm, the landlord must repair or replace it as soon as reasonably practicable.",
    url: "https://www.legislation.gov.uk/all?title=smoke%20and%20carbon%20monoxide%20alarm",
  },
  {
    id: "req_pap_response",
    kind: "requirement",
    title: "Reply to the letter of claim within 20 working days",
    citation: "Pre-Action Protocol for Housing Conditions Claims",
    excerpt: "Before court proceedings, the landlord should normally respond to a letter of claim within 20 working days.",
    url: "https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/prot_hou",
  },
];

/** HHSRS hazards are the shared subject matter that links requirements together. */
const hazardNodes: LawNode[] = [
  {
    id: "hazard-damp-mould",
    kind: "hazard",
    title: "Damp & mould",
    citation: "HHSRS — damp and mould growth",
    excerpt: "A serious hazard linked to respiratory illness; the centre of Awaab's Law phase 1.",
    url: HHSRS,
  },
  {
    id: "hazard-excess-cold",
    kind: "hazard",
    title: "Excess cold",
    citation: "HHSRS — excess cold",
    excerpt: "A home that cannot be kept warm enough — usually the heating or hot water.",
    url: HHSRS,
  },
  {
    id: "hazard-electrical",
    kind: "hazard",
    title: "Electrical hazards",
    citation: "HHSRS — electrical hazards",
    excerpt: "Faulty wiring or installations that create a shock or fire risk.",
    url: HHSRS,
  },
  {
    id: "hazard-gas",
    kind: "hazard",
    title: "Gas & carbon monoxide",
    citation: "HHSRS — explosion and carbon monoxide",
    excerpt: "Gas leaks and carbon monoxide are life-threatening hazards.",
    url: HHSRS,
  },
  {
    id: "hazard-security",
    kind: "hazard",
    title: "Security",
    citation: "HHSRS — entry by intruders",
    excerpt: "A home that cannot be secured (broken locks, doors, windows) leaves the tenant unsafe.",
    url: HHSRS,
  },
  {
    id: "hazard-smoke-co",
    kind: "hazard",
    title: "Smoke & CO alarms",
    citation: "HHSRS — fire and carbon monoxide",
    excerpt: "Missing or faulty alarms remove the warning that saves lives in a fire or gas leak.",
    url: HHSRS,
  },
];

// `linksTo` points from the narrower source up to a broader one; invert it so
// edges run parent → child and the citation path can be walked upwards.
const sourceEdges: LawEdge[] = (Object.values(LEGAL_SOURCES) as LegalSource[]).flatMap((s) =>
  (s.linksTo ?? []).map((l) => ({ from: l.id, to: s.id, label: l.relation })),
);

/** Source → the enforceable requirement it contains (structural, forms the path). */
const requirementEdges: LawEdge[] = [
  { from: "lta1985_s9a", to: "req_s9a_fitness", label: "prescribes" },
  { from: "lta1985_s11", to: "req_s11_repair", label: "prescribes" },
  { from: "lta1985_s11", to: "req_s11_6_access", label: "prescribes" },
  { from: "awaab_regs_2025", to: "req_awaab_investigate", label: "prescribes" },
  { from: "awaab_regs_2025", to: "req_awaab_summary", label: "prescribes" },
  { from: "awaab_regs_2025", to: "req_awaab_works", label: "prescribes" },
  { from: "awaab_regs_2025", to: "req_awaab_emergency", label: "prescribes" },
  { from: "alarm_regs", to: "req_alarm_repair", label: "prescribes" },
  { from: "pap_housing", to: "req_pap_response", label: "prescribes" },
];

/** Relevance: the same hazard grounds several requirements, and related requirements link to each other. */
const relevanceEdges: LawEdge[] = [
  { from: "req_s9a_fitness", to: "hazard-damp-mould", label: "covers" },
  { from: "req_awaab_investigate", to: "hazard-damp-mould", label: "covers" },
  { from: "req_awaab_emergency", to: "hazard-damp-mould", label: "covers" },
  { from: "req_s11_repair", to: "hazard-excess-cold", label: "covers" },
  { from: "req_s11_repair", to: "hazard-electrical", label: "covers" },
  { from: "req_s11_repair", to: "hazard-gas", label: "covers" },
  { from: "req_s11_repair", to: "hazard-security", label: "covers" },
  { from: "req_alarm_repair", to: "hazard-smoke-co", label: "covers" },
  { from: "req_alarm_repair", to: "hazard-gas", label: "covers" },
  { from: "req_awaab_investigate", to: "req_s9a_fitness", label: "relevant" },
  { from: "req_awaab_works", to: "req_s11_repair", label: "relevant" },
  { from: "req_awaab_emergency", to: "req_s11_6_access", label: "relevant" },
  { from: "req_alarm_repair", to: "req_s11_repair", label: "relevant" },
  { from: "req_awaab_investigate", to: "req_pap_response", label: "relevant" },
];

export const lawGraph: LawGraph = {
  nodes: [...sourceNodes, ...requirementNodes, ...hazardNodes],
  edges: [...sourceEdges, ...requirementEdges, ...relevanceEdges],
};

export function findSource(id: string): LawNode | undefined {
  return lawGraph.nodes.find((n) => n.id === id);
}
