/**
 * The legal knowledge graph behind every obligation the engine produces.
 *
 * This is the citation/explanation layer — it says *where a duty comes from*,
 * never what the duty is. The engine (rules.ts) still decides duties and
 * deadlines deterministically; each obligation carries a `sourceId` that points
 * into this graph so the UI can show its working.
 *
 * Shape is deliberately Neo4j-ready: nodes + edges with typed kinds. When the
 * graph moves into Neo4j, `GET /api/law/graph` swaps this in-memory table for a
 * Cypher query and nothing else in the UI changes.
 */

export type LawNodeKind = "statute" | "section" | "regulation" | "requirement" | "case" | "protocol" | "standard" | "hazard";

export interface LawNode {
  id: string;
  kind: LawNodeKind;
  title: string;
  citation: string;
  /** The actual point taken from the document, in plain words. */
  excerpt: string;
  /** Link to the primary source (legislation.gov.uk, bailii, etc.). Empty = internal. */
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

const GOV = (path: string) => `https://www.legislation.gov.uk/${path}`;

export const lawGraph: LawGraph = {
  nodes: [
    // Statutes
    {
      id: "lta-1985",
      kind: "statute",
      title: "Landlord and Tenant Act 1985",
      citation: "Landlord and Tenant Act 1985 (c. 70)",
      excerpt: "The Act that sets out a landlord's repairing obligations and the fitness standard for rented homes.",
      url: GOV("ukpga/1985/70/contents"),
    },
    {
      id: "shra-2023",
      kind: "statute",
      title: "Social Housing (Regulation) Act 2023",
      citation: "Social Housing (Regulation) Act 2023 (c. 36)",
      excerpt: "Introduced Awaab's Law, requiring social landlords to investigate and fix reported hazards within fixed timescales.",
      url: GOV("ukpga/2023/36/contents"),
    },
    // Sections
    {
      id: "lta-1985-s9a",
      kind: "section",
      title: "Section 9A — Fitness for human habitation",
      citation: "Landlord and Tenant Act 1985, s. 9A",
      excerpt: "A landlord lets a property with an implied term that it is fit for human habitation — covering HHSRS hazards such as damp and mould.",
      url: GOV("ukpga/1985/70/section/9A"),
    },
    {
      id: "lta-1985-s11",
      kind: "section",
      title: "Section 11 — Repairing obligations",
      citation: "Landlord and Tenant Act 1985, s. 11",
      excerpt: "The landlord must keep in repair the structure and exterior, and installations for water, gas, electricity, sanitation and heating.",
      url: GOV("ukpga/1985/70/section/11"),
    },
    {
      id: "lta-1985-s11-6",
      kind: "section",
      title: "Section 11(6) — Right of entry",
      citation: "Landlord and Tenant Act 1985, s. 11(6)",
      excerpt: "The landlord may enter to view the condition or state of repair only after giving at least 24 hours' written notice.",
      url: GOV("ukpga/1985/70/section/11"),
    },
    {
      id: "shra-2023-s42",
      kind: "section",
      title: "Section 42 — Awaab's Law",
      citation: "Social Housing (Regulation) Act 2023, s. 42",
      excerpt: "Requires the Secretary of State to make regulations setting time limits for social landlords to investigate and remedy hazards.",
      url: GOV("ukpga/2023/36/section/42"),
    },
    // Regulations
    {
      id: "awaab-2025",
      kind: "regulation",
      title: "Hazards in Social Housing (Prescribed Requirements) Regulations 2025",
      citation: "Hazards in Social Housing (Prescribed Requirements) (England) Regulations 2025",
      excerpt: "The regulations that turn Awaab's Law into concrete, enforceable deadlines for social landlords.",
      url: "https://www.legislation.gov.uk/all?title=Hazards%20in%20Social%20Housing%20(Prescribed%20Requirements)",
    },
    {
      id: "smoke-co-2022",
      kind: "regulation",
      title: "Smoke and Carbon Monoxide Alarm Regulations 2022",
      citation: "Smoke and Carbon Monoxide Alarm (Amendment) (England) Regulations 2022",
      excerpt: "Requires landlords to repair or replace smoke and carbon monoxide alarms when reported faulty, as soon as reasonably practicable.",
      url: "https://www.legislation.gov.uk/all?title=smoke%20and%20carbon%20monoxide%20alarm",
    },
    // Requirements (the enforceable points)
    {
      id: "lta-1985-s9a-fitness",
      kind: "requirement",
      title: "Home fit for human habitation",
      citation: "Landlord and Tenant Act 1985, s. 9A",
      excerpt: "Fix the cause so the home is fit to live in — a continuing duty while the hazard affects the tenant.",
      url: GOV("ukpga/1985/70/section/9A"),
    },
    {
      id: "lta-1985-s11-repair",
      kind: "requirement",
      title: "Repair within a reasonable time",
      citation: "Landlord and Tenant Act 1985, s. 11",
      excerpt: "Once given notice, the landlord must carry out the repair within a reasonable time of the tenant's report.",
      url: GOV("ukpga/1985/70/section/11"),
    },
    {
      id: "lta-1985-s11-6-access",
      kind: "requirement",
      title: "24 hours' written notice to enter",
      citation: "Landlord and Tenant Act 1985, s. 11(6)",
      excerpt: "The landlord can only enter to inspect or repair with at least 24 hours' written notice (unless it's an emergency).",
      url: GOV("ukpga/1985/70/section/11"),
    },
    {
      id: "awaab-2025-investigate",
      kind: "requirement",
      title: "Investigate within 10 working days",
      citation: "Awaab's Law (2025 Regulations)",
      excerpt: "A social landlord must investigate a reported hazard within 10 working days of becoming aware of it.",
      url: "https://www.legislation.gov.uk/all?title=Hazards%20in%20Social%20Housing%20(Prescribed%20Requirements)",
    },
    {
      id: "awaab-2025-summary",
      kind: "requirement",
      title: "Written summary within 3 working days",
      citation: "Awaab's Law (2025 Regulations)",
      excerpt: "Within 3 working days of the investigation, the landlord must send the tenant a written summary of the findings.",
      url: "https://www.legislation.gov.uk/all?title=Hazards%20in%20Social%20Housing%20(Prescribed%20Requirements)",
    },
    {
      id: "awaab-2025-works",
      kind: "requirement",
      title: "Begin works within 5 working days",
      citation: "Awaab's Law (2025 Regulations)",
      excerpt: "Safety works must begin within 5 working days of the investigation concluding.",
      url: "https://www.legislation.gov.uk/all?title=Hazards%20in%20Social%20Housing%20(Prescribed%20Requirements)",
    },
    {
      id: "awaab-2025-emergency",
      kind: "requirement",
      title: "Make safe within 24 hours",
      citation: "Awaab's Law (2025 Regulations)",
      excerpt: "For an emergency hazard, the landlord must investigate and make the home safe within 24 hours.",
      url: "https://www.legislation.gov.uk/all?title=Hazards%20in%20Social%20Housing%20(Prescribed%20Requirements)",
    },
    {
      id: "smoke-co-2022-repair",
      kind: "requirement",
      title: "Repair or replace faulty alarms",
      citation: "Smoke and Carbon Monoxide Alarm Regulations 2022",
      excerpt: "When a tenant reports a faulty alarm, the landlord must repair or replace it as soon as reasonably practicable.",
      url: "https://www.legislation.gov.uk/all?title=smoke%20and%20carbon%20monoxide%20alarm",
    },
    // Case law
    {
      id: "warren-v-keen",
      kind: "case",
      title: "Warren v Keen [1954]",
      citation: "Warren v Keen [1954] 1 QB 15",
      excerpt: "A tenant must use the premises in a tenant-like manner — so damage caused by the household falls on the tenant, not the landlord.",
      url: "https://www.bailii.org/ew/cases/EWHC/QB/1953/",
    },
    // Hazards (HHSRS) — the shared subject matter that links requirements together
    {
      id: "hazard-damp-mould",
      kind: "hazard",
      title: "Damp & mould",
      citation: "HHSRS category — damp and mould growth",
      excerpt: "A serious hazard linked to respiratory illness; the centre of Awaab's Law.",
      url: "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system",
    },
    {
      id: "hazard-excess-cold",
      kind: "hazard",
      title: "Excess cold",
      citation: "HHSRS category — excess cold",
      excerpt: "A home that cannot be kept warm enough — usually a broken boiler or heating system.",
      url: "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system",
    },
    {
      id: "hazard-electrical",
      kind: "hazard",
      title: "Electrical hazards",
      citation: "HHSRS category — electrical hazards",
      excerpt: "Faulty wiring or installations that create a shock or fire risk.",
      url: "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system",
    },
    {
      id: "hazard-gas",
      kind: "hazard",
      title: "Gas & carbon monoxide",
      citation: "HHSRS category — explosion and CO",
      excerpt: "Gas leaks and carbon monoxide are both life-threatening hazards.",
      url: "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system",
    },
    {
      id: "hazard-security",
      kind: "hazard",
      title: "Security",
      citation: "HHSRS category — entry by intruders",
      excerpt: "A home that cannot be secured (broken locks, windows, doors) leaves the tenant unsafe.",
      url: "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system",
    },
    // Protocols and standards
    {
      id: "pre-action-protocol",
      kind: "protocol",
      title: "Pre-Action Protocol for Housing Conditions Claims",
      citation: "Pre-Action Protocol for Housing Conditions Claims (England)",
      excerpt: "Before court proceedings, the landlord must respond to a letter of claim within 20 working days.",
      url: "https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/prot_hou",
    },
    {
      id: "docket-standard",
      kind: "standard",
      title: "Docket service standard",
      citation: "Docket service standard (not legislation)",
      excerpt: "A Docket policy, not a legal deadline: every report gets an acknowledgement so the tenant knows it was received.",
      url: "",
    },
    {
      id: "tenancy-agreement",
      kind: "standard",
      title: "Tenancy agreement — supplied appliances",
      citation: "Tenancy agreement (landlord-supplied appliances)",
      excerpt: "The tenancy lists which appliances the landlord supplied, so a repair duty can rest on the contract rather than statute.",
      url: "",
    },
  ],
  edges: [
    { from: "lta-1985", to: "lta-1985-s9a", label: "contains" },
    { from: "lta-1985", to: "lta-1985-s11", label: "contains" },
    { from: "lta-1985-s9a", to: "lta-1985-s9a-fitness", label: "prescribes" },
    { from: "lta-1985-s11", to: "lta-1985-s11-repair", label: "prescribes" },
    { from: "lta-1985-s11", to: "lta-1985-s11-6", label: "contains" },
    { from: "lta-1985-s11-6", to: "lta-1985-s11-6-access", label: "prescribes" },
    { from: "shra-2023", to: "shra-2023-s42", label: "contains" },
    { from: "shra-2023-s42", to: "awaab-2025", label: "enacts" },
    { from: "awaab-2025", to: "awaab-2025-investigate", label: "prescribes" },
    { from: "awaab-2025", to: "awaab-2025-summary", label: "prescribes" },
    { from: "awaab-2025", to: "awaab-2025-works", label: "prescribes" },
    { from: "awaab-2025", to: "awaab-2025-emergency", label: "prescribes" },
    { from: "smoke-co-2022", to: "smoke-co-2022-repair", label: "prescribes" },
    { from: "warren-v-keen", to: "lta-1985-s11-repair", label: "informs" },
    // Relevance links: the same hazard grounds several requirements, and
    // requirements that share a subject matter are related.
    { from: "lta-1985-s9a-fitness", to: "hazard-damp-mould", label: "covers" },
    { from: "awaab-2025-investigate", to: "hazard-damp-mould", label: "covers" },
    { from: "awaab-2025-emergency", to: "hazard-damp-mould", label: "covers" },
    { from: "lta-1985-s11-repair", to: "hazard-excess-cold", label: "covers" },
    { from: "lta-1985-s11-repair", to: "hazard-electrical", label: "covers" },
    { from: "lta-1985-s11-repair", to: "hazard-gas", label: "covers" },
    { from: "lta-1985-s11-repair", to: "hazard-security", label: "covers" },
    { from: "smoke-co-2022-repair", to: "hazard-gas", label: "covers" },
    { from: "awaab-2025-investigate", to: "lta-1985-s9a-fitness", label: "relevant" },
    { from: "awaab-2025-works", to: "lta-1985-s11-repair", label: "relevant" },
    { from: "awaab-2025-emergency", to: "lta-1985-s11-6-access", label: "relevant" },
    { from: "smoke-co-2022-repair", to: "lta-1985-s11", label: "relevant" },
  ],
};

export function findSource(id: string): LawNode | undefined {
  return lawGraph.nodes.find((n) => n.id === id);
}
