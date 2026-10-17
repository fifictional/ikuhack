"use client";

import { useEffect, useMemo, useState } from "react";
import type { Obligation } from "@/lib/domain/types";
import type { LawGraph, LawNode, LawNodeKind } from "@/lib/law/sources";

/**
 * Slide-in panel that shows the *whole* legal knowledge graph, highlights the
 * node this obligation rests on, and quotes the fact from the source document
 * with a link to it. Reads from /api/law/graph, so swapping that route to Neo4j
 * later changes nothing here.
 */

const KIND_LABEL: Record<LawNodeKind, string> = {
  statute: "Statute",
  section: "Section",
  regulation: "Regulation",
  requirement: "Requirement",
  case: "Case law",
  protocol: "Protocol",
  standard: "Service standard",
};

const KIND_COLOR: Record<LawNodeKind, string> = {
  statute: "var(--teal-dark)",
  section: "var(--teal)",
  regulation: "var(--teal)",
  requirement: "var(--terracotta)",
  case: "var(--terracotta-dark)",
  protocol: "var(--ink)",
  standard: "var(--muted)",
};

const NODE_R = 16;
const H_GAP = 200;
const V_GAP = 84;

type Pos = Record<string, { x: number; y: number }>;

function layout(graph: LawGraph): Pos {
  const depth = new Map<string, number>();
  for (const n of graph.nodes) depth.set(n.id, 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of graph.edges) {
      const d = (depth.get(e.from) ?? 0) + 1;
      if (d > (depth.get(e.to) ?? 0)) {
        depth.set(e.to, d);
        changed = true;
      }
    }
  }
  const byLayer = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const l = depth.get(n.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  }
  const maxCount = Math.max(...[...byLayer.values()].map((a) => a.length));
  const pos: Pos = {};
  for (const [l, ids] of byLayer) {
    const offset = ((maxCount - ids.length) * V_GAP) / 2;
    ids.forEach((id, i) => {
      pos[id] = { x: l * H_GAP, y: offset + i * V_GAP };
    });
  }
  return pos;
}

function ancestors(graph: LawGraph, id: string): Set<string> {
  const parents = new Map<string, string[]>();
  for (const n of graph.nodes) parents.set(n.id, []);
  for (const e of graph.edges) parents.get(e.to)!.push(e.from);
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

export function LawGraphPanel({ obligation, onClose }: { obligation: Obligation | null; onClose: () => void }) {
  const [graph, setGraph] = useState<LawGraph | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (obligation && !graph && !failed) {
      fetch("/api/law/graph")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then(setGraph)
        .catch(() => setFailed(true));
    }
  }, [obligation, graph, failed]);

  const sourceId = obligation?.legalBasis.sourceId;
  const focus = useMemo(() => (graph && sourceId ? graph.nodes.find((n) => n.id === sourceId) : undefined), [graph, sourceId]);
  const pos = useMemo(() => (graph ? layout(graph) : ({} as Pos)), [graph]);
  const highlight = useMemo(() => (graph && sourceId ? ancestors(graph, sourceId) : new Set<string>()), [graph, sourceId]);

  if (!obligation) return null;

  const kind = obligation.legalBasis.statutory ? "Legal duty" : "Docket target";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full bg-ink/30 backdrop-blur-sm" />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface shadow-2xl animate-[slidein_0.25s_ease-out]">
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
          <div className="rounded-xl bg-teal-tint p-4">
            <p className="text-xs uppercase tracking-wide text-muted">In plain English</p>
            <p className="mt-1 text-sm text-foreground">{obligation.reason}</p>
          </div>

          {failed ? (
            <p className="text-sm text-danger">Couldn&apos;t load the legal graph.</p>
          ) : !graph ? (
            <p className="text-sm text-muted">Loading the legal graph…</p>
          ) : !focus ? (
            <p className="text-sm text-muted">No legal source is attached to this duty.</p>
          ) : (
            <>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted">{KIND_LABEL[focus.kind]} · highlighted in the graph</p>
                <h3 className="mt-1 text-base font-semibold">{focus.title}</h3>
                <p className="mt-0.5 font-mono text-xs text-muted">{focus.citation}</p>
                <p className="mt-3 text-sm text-foreground">{focus.excerpt}</p>
                {focus.url ? (
                  <a href={focus.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-teal underline">
                    Open the source ↗
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-muted">Internal standard — no public link.</p>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted">The legal graph</p>
                <LawGraphSvg graph={graph} pos={pos} focusId={focus.id} highlight={highlight} />
                <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <li key={k} className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[k as LawNodeKind] }} />
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

function LawGraphSvg({ graph, pos, focusId, highlight }: { graph: LawGraph; pos: Pos; focusId: string; highlight: Set<string> }) {
  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const minX = Math.min(...xs) - 110;
  const maxX = Math.max(...xs) + 110;
  const minY = Math.min(...ys) - 60;
  const maxY = Math.max(...ys) + 70;

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="mt-2 w-full rounded-xl border border-border bg-cream-soft" role="img" aria-label="Legal knowledge graph">
      {graph.edges.map((e) => {
        const a = pos[e.from];
        const b = pos[e.to];
        if (!a || !b) return null;
        const mid = (a.x + b.x) / 2;
        const onPath = highlight.has(e.from) && highlight.has(e.to);
        return (
          <g key={`${e.from}->${e.to}`}>
            <path
              d={`M ${a.x + NODE_R} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x - NODE_R} ${b.y}`}
              fill="none"
              stroke={onPath ? "var(--terracotta)" : "var(--line)"}
              strokeWidth={onPath ? 2.5 : 1.25}
              strokeDasharray={onPath ? "4 3" : undefined}
              opacity={onPath ? 1 : 0.45}
            />
            <text x={mid} y={(a.y + b.y) / 2 - 5} textAnchor="middle" className="fill-muted" fontSize={9}>
              {e.label}
            </text>
          </g>
        );
      })}

      {graph.nodes.map((n) => {
        const p = pos[n.id];
        if (!p) return null;
        const isFocus = n.id === focusId;
        const onPath = highlight.has(n.id);
        const dim = highlight.size > 0 && !onPath;
        const lines = wrap(n.title, 24);
        return (
          <g key={n.id} opacity={dim ? 0.35 : 1}>
            {isFocus && <circle cx={p.x} cy={p.y} r={20} fill="var(--terracotta)" opacity={0.25}><animate attributeName="r" values="20;36;20" dur="1.8s" repeatCount="indefinite" /></circle>}
            <circle cx={p.x} cy={p.y} r={isFocus ? NODE_R + 3 : NODE_R} fill={KIND_COLOR[n.kind]} stroke={isFocus ? "var(--ink)" : "none"} strokeWidth={2} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill="var(--white)">{(n.kind[0] ?? "").toUpperCase()}</text>
            {lines.map((line, i) => (
              <text key={i} x={p.x} y={p.y + NODE_R + 14 + i * 11} textAnchor="middle" fontSize={9.5} fill={isFocus ? "var(--terracotta-dark)" : "var(--ink)"} fontWeight={isFocus ? 700 : 400}>
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
