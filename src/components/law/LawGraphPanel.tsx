"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { Obligation } from "@/lib/domain/types";
import { deadlineLabel } from "@/lib/ui/labels";
import type { LawGraph, LawNode, LawNodeKind } from "@/lib/law/graph";

/**
 * Slide-in panel that shows the *whole* legal knowledge graph as an
 * interactive, force-directed network. It highlights the node this obligation
 * rests on, quotes the source document, and links out to it. Clicking any node
 * re-focuses the panel on that node.
 *
 * Data comes from /api/law/graph, so swapping that route to Neo4j later
 * changes nothing here.
 */

const KIND_LABEL: Record<LawNodeKind, string> = {
  statute: "Statute",
  section: "Section",
  regulation: "Regulation",
  requirement: "Requirement",
  case: "Case law",
  protocol: "Protocol",
  standard: "Service standard",
  hazard: "Hazard",
  guidance: "Guidance",
};

// Accent palette for the graph (the app chrome stays greyscale).
const C = {
  teal: "#125951",
  tealDark: "#0c403a",
  terracotta: "#c65729",
  terracottaDark: "#a4461f",
  ink: "#1a1a1a",
  muted: "#6b6158",
  cream: "#e9ddc7",
  line: "#e4e4e0",
  white: "#ffffff",
  logoDoor: "#8a8a8a",
};

const KIND_COLOR: Record<LawNodeKind, string> = {
  statute: C.tealDark,
  section: C.teal,
  regulation: C.teal,
  requirement: C.terracotta,
  case: C.terracottaDark,
  protocol: C.ink,
  standard: C.muted,
  hazard: C.cream,
  guidance: C.logoDoor,
};

/** Legal relationships that trace a source back to its statute. Relevance links render but don't form the citation path. */
const STRUCTURAL = new Set(["inserted_by", "made_under", "amended_by", "interprets", "extends"]);

function ancestors(graph: LawGraph, id: string): Set<string> {
  const parents = new Map<string, string[]>();
  for (const n of graph.nodes) parents.set(n.id, []);
  for (const e of graph.edges) {
    if (!STRUCTURAL.has(e.label)) continue;
    parents.get(e.to)!.push(e.from);
  }
  const set = new Set<string>();
  const walk = (cur: string) => {
    if (set.has(cur)) return;
    set.add(cur);
    for (const p of parents.get(cur) ?? []) walk(p);
  };
  walk(id);
  return set;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines.slice(0, 2);
}

interface SimNode extends LawNode, SimulationNodeDatum {}
interface SimLink extends SimulationLinkDatum<SimNode> {
  label: string;
}

export function LawGraphPanel({ obligation, onClose }: { obligation: Obligation | null; onClose: () => void }) {
  const [graph, setGraph] = useState<LawGraph | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (obligation && !graph && !failed) {
      fetch("/api/law/graph")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then(setGraph)
        .catch(() => setFailed(true));
    }
  }, [obligation, graph, failed]);

  // Opening a different duty remounts the panel (see the `key` in ObligationList), so
  // `selectedId` starts fresh for each one — no reset effect needed here.
  const sourceId = obligation?.legalBasis.sourceId;
  const effectiveId = selectedId ?? sourceId ?? null;
  const focus = useMemo(() => (graph && effectiveId ? graph.nodes.find((n) => n.id === effectiveId) : undefined), [graph, effectiveId]);
  const highlight = useMemo(() => (graph && effectiveId ? ancestors(graph, effectiveId) : new Set<string>()), [graph, effectiveId]);

  if (!obligation) return null;

  const kind = deadlineLabel(obligation);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full bg-ink/30 backdrop-blur-sm" />
      <aside className="relative h-full w-full max-w-4xl overflow-y-auto border-l border-border bg-surface shadow-2xl animate-[slidein_0.25s_ease-out]">
        <style>{`
          @keyframes slidein { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        `}</style>

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Where this comes from</p>
            <h2 className="text-lg font-semibold">{kind}</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:text-foreground">
            Close ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="rounded-xl p-4" style={{ background: "#e4efec" }}>
            <p className="text-xs uppercase tracking-wide text-muted">In plain English</p>
            <p className="mt-1 text-sm text-foreground">{obligation.reason}</p>
          </div>

          {failed ? (
            <p className="text-sm text-danger">Couldn&apos;t load the legal graph.</p>
          ) : !graph ? (
            <p className="text-sm text-muted">Loading the legal graph…</p>
          ) : (
            <>
              <div className="rounded-xl border border-border p-4">
                {focus ? (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted">{KIND_LABEL[focus.kind]} · highlighted in the graph</p>
                    <h3 className="mt-1 text-base font-semibold">{focus.title}</h3>
                    <p className="mt-0.5 font-mono text-xs text-muted">{focus.citation}</p>
                    <p className="mt-3 text-sm text-foreground">{focus.excerpt}</p>
                    {focus.url ? (
                      <a href={focus.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium underline" style={{ color: "#125951" }}>
                        Open the source ↗
                      </a>
                    ) : (
                      <p className="mt-3 text-xs text-muted">Internal standard — no public link.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">No legal source is attached to this duty.</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted">The legal graph</p>
                  <p className="text-xs text-muted">click a node to open its source · drag to move · scroll to zoom</p>
                </div>
                <ForceGraph graph={graph} focusId={effectiveId} highlight={highlight} onSelect={setSelectedId} />
                <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <li key={k} className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full border border-line" style={{ background: KIND_COLOR[k as LawNodeKind] }} />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function ForceGraph({ graph, focusId, highlight, onSelect }: { graph: LawGraph; focusId: string | null; highlight: Set<string>; onSelect: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const sizeRef = useRef({ w: 640, h: 440 });
  const tRef = useRef({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ type: "pan" | "node"; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [size, setSize] = useState({ w: 640, h: 440 });
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const simNodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = graph.edges.map((e) => ({ source: e.from, target: e.to, label: e.label }));
    const sim = forceSimulation<SimNode>(simNodes)
      .force("link", forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance((l) => (l.label === "covers" ? 78 : 130)).strength(0.5))
      .force("charge", forceManyBody<SimNode>().strength(-300))
      .force("center", forceCenter<SimNode>(0, 0))
      .force("collide", forceCollide<SimNode>(46));
    sim.on("tick", () => setNodes([...simNodes]));
    simRef.current = sim;
    nodesRef.current = simNodes;
    return () => {
      sim.stop();
    };
  }, [graph]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) {
        sizeRef.current.w = w;
        setSize({ w, h: 440 });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const cur = tRef.current;
      const k2 = Math.min(2.6, Math.max(0.35, cur.k * Math.pow(1.0015, -e.deltaY)));
      const cx = sizeRef.current.w / 2 + cur.x;
      const cy = sizeRef.current.h / 2 + cur.y;
      const next = { x: px - (px - cx) * (k2 / cur.k) - sizeRef.current.w / 2, y: py - (py - cy) * (k2 / cur.k) - sizeRef.current.h / 2, k: k2 };
      tRef.current = next;
      setT(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toGraph = (cx: number, cy: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const cur = tRef.current;
    return {
      x: (cx - rect.left - sizeRef.current.w / 2 - cur.x) / cur.k,
      y: (cy - rect.top - sizeRef.current.h / 2 - cur.y) / cur.k,
    };
  };

  const startPan = (e: React.PointerEvent) => {
    dragRef.current = { type: "pan", sx: e.clientX, sy: e.clientY, ox: tRef.current.x, oy: tRef.current.y, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const startNode = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    dragRef.current = { type: "node", id, sx: e.clientX, sy: e.clientY, ox: 0, oy: 0, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.type === "pan") {
      const next = { x: d.ox + dx, y: d.oy + dy, k: tRef.current.k };
      tRef.current = next;
      setT(next);
    } else if (d.type === "node" && d.id) {
      const node = nodesRef.current.find((n) => n.id === d.id);
      if (node) {
        const g = toGraph(e.clientX, e.clientY);
        node.fx = g.x;
        node.fy = g.y;
        simRef.current?.alphaTarget(0.3).restart();
        setNodes([...nodesRef.current]);
      }
    }
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.type === "node") {
      const node = d.id ? nodesRef.current.find((n) => n.id === d.id) : undefined;
      if (!d.moved && d.id) {
        onSelect(d.id);
        if (node?.url) window.open(node.url, "_blank", "noopener,noreferrer");
      }
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      simRef.current?.alphaTarget(0);
    }
  };

  const posById = new Map(nodes.map((n) => [n.id, n]));
  const tx = size.w / 2 + t.x;
  const ty = size.h / 2 + t.y;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={size.h}
      className="mt-2 cursor-grab touch-none select-none rounded-xl border border-border bg-cream-soft active:cursor-grabbing"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label="Interactive legal knowledge graph"
    >
      <rect width="100%" height="100%" fill="transparent" onPointerDown={startPan} />
      <g transform={`translate(${tx} ${ty}) scale(${t.k})`}>
        {graph.edges.map((l) => {
          const s = posById.get(l.from);
          const tg = posById.get(l.to);
          if (!s || !tg) return null;
          const onPath = highlight.has(l.from) && highlight.has(l.to) && STRUCTURAL.has(l.label);
          return (
            <line
              key={`${l.from}->${l.to}`}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={tg.x ?? 0}
              y2={tg.y ?? 0}
              stroke={onPath ? C.terracotta : C.muted}
              strokeWidth={onPath ? 2.5 : 1.3}
              opacity={onPath ? 0.9 : 0.5}
            />
          );
        })}

        {nodes.map((n) => {
          const isFocus = n.id === focusId;
          const onPath = highlight.has(n.id);
          const dim = highlight.size > 0 && !onPath;
          const r = isFocus ? 20 : hovered === n.id ? 18 : 14;
          const lines = wrap(n.title, 22);
          return (
            <g
              key={n.id}
              opacity={dim ? 0.55 : 1}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => startNode(e, n.id)}
              onPointerEnter={() => setHovered(n.id)}
              onPointerLeave={() => setHovered(null)}
            >
              {isFocus && (
                <circle cx={n.x ?? 0} cy={n.y ?? 0} r={20} fill={C.terracotta} opacity={0.25}>
                  <animate attributeName="r" values="20;36;20" dur="1.8s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={n.x ?? 0}
                cy={n.y ?? 0}
                r={r}
                fill={KIND_COLOR[n.kind]}
                stroke={isFocus ? C.ink : n.kind === "hazard" ? C.line : "none"}
                strokeWidth={isFocus ? 2 : 1}
              />
              <text x={n.x ?? 0} y={(n.y ?? 0) + 4} textAnchor="middle" fontSize={11} fill={n.kind === "hazard" ? C.ink : C.white}>
                {(n.kind[0] ?? "").toUpperCase()}
              </text>
              {lines.map((line, i) => (
                <text key={i} x={n.x ?? 0} y={(n.y ?? 0) + r + 13 + i * 11} textAnchor="middle" fontSize={9.5} fill={isFocus ? C.terracottaDark : C.ink} fontWeight={isFocus ? 700 : 400}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
