import { LEGAL_SOURCES, type LegalSource } from "@/lib/engine/sources";

/**
 * A render-ready view of the legal knowledge graph.
 *
 * The source of truth is `src/lib/engine/sources.ts` (the verified register the
 * engine cites via `LegalBasis.sourceId`). This file only reshapes it into
 * nodes + edges for the citation panel, adding HHSRS hazard nodes and
 * relevance links so requirements cluster by subject matter.
 *
 * Swap the /api/law/graph route for a Neo4j query later and the UI is unchanged.
 */

export type LawNodeKind = "statute" | "section" | "regulation" | "requirement" | "case" | "protocol" | "standard" | "hazard" | "guidance";

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

// `linksTo` points from the narrower source up to a broader one; invert it so
// edges run parent → child and the citation path can be walked upwards.
const sourceEdges: LawEdge[] = (Object.values(LEGAL_SOURCES) as LegalSource[]).flatMap((s) =>
  (s.linksTo ?? []).map((l) => ({ from: l.id, to: s.id, label: l.relation })),
);

const HHSRS = "https://www.legislation.gov.uk/all?title=housing%20health%20and%20safety%20rating%20system";

/** HHSRS hazards are the shared subject matter that links requirements together. */
const hazards: LawNode[] = [
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
];

const relevanceEdges: LawEdge[] = [
  { from: "lta1985_s9a", to: "hazard-damp-mould", label: "covers" },
  { from: "awaab_regs_2025", to: "hazard-damp-mould", label: "covers" },
  { from: "lta1985_s11", to: "hazard-excess-cold", label: "covers" },
  { from: "lta1985_s11", to: "hazard-electrical", label: "covers" },
  { from: "lta1985_s11", to: "hazard-gas", label: "covers" },
  { from: "lta1985_s11", to: "hazard-security", label: "covers" },
  { from: "alarm_regs", to: "hazard-gas", label: "covers" },
  { from: "awaab_regs_2025", to: "lta1985_s9a", label: "relevant" },
  { from: "awaab_regs_2025", to: "lta1985_s11", label: "relevant" },
  { from: "lta1985_s10a", to: "lta1985_s11", label: "relevant" },
  { from: "alarm_regs", to: "lta1985_s11", label: "relevant" },
];

export const lawGraph: LawGraph = {
  nodes: [...sourceNodes, ...hazards],
  edges: [...sourceEdges, ...relevanceEdges],
};

export function findSource(id: string): LawNode | undefined {
  return lawGraph.nodes.find((n) => n.id === id);
}
