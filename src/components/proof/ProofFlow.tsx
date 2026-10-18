import type { BatchSummary } from "@/lib/solana/proof";

/** How records become one on-chain fingerprint: leaves → Merkle root → Solana memo. Counts are the latest batch's real numbers. */
export function ProofFlow({ batch, verified }: { batch: BatchSummary; verified: boolean | null }) {
  const c = batch.byKind;
  const compliance = (c.compliance_record ?? 0) + (c.compliance_copy ?? 0) + (c.compliance_certificate ?? 0);
  const groups = [
    { label: "Evidence files", n: c.evidence ?? 0 },
    { label: "Case logs", n: c.case_head ?? 0 },
    { label: "Compliance records", n: compliance },
  ];
  return (
    <svg viewBox="0 0 640 220" role="img" aria-label="Records are combined into one Merkle root and written to Solana" className="w-full">
      {groups.map((g, i) => {
        const y = 20 + i * 62;
        return (
          <g key={g.label}>
            <rect x="8" y={y} width="170" height="48" rx="8" className="fill-surface stroke-border" />
            <text x="22" y={y + 21} className="fill-ink text-[13px] font-semibold">{g.label}</text>
            <text x="22" y={y + 38} className="fill-muted font-mono text-[12px]">{g.n} fingerprint{g.n === 1 ? "" : "s"}</text>
            <path d={`M178 ${y + 24} C 230 ${y + 24}, 230 110, 270 110`} className="fill-none stroke-border" strokeWidth="2" />
          </g>
        );
      })}
      <rect x="270" y="78" width="140" height="64" rx="10" className="fill-primary-tint stroke-primary" strokeWidth="2" />
      <text x="340" y="104" textAnchor="middle" className="fill-ink text-[13px] font-semibold">Merkle root</text>
      <text x="340" y="123" textAnchor="middle" className="fill-muted font-mono text-[11px]">{batch.root.slice(0, 10)}…{batch.root.slice(-6)}</text>
      <path d="M410 110 L 462 110" className="stroke-primary" strokeWidth="2" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-primary" />
        </marker>
      </defs>
      <rect x="466" y="70" width="166" height="80" rx="10" className="fill-primary stroke-primary" />
      <text x="549" y="97" textAnchor="middle" className="fill-white text-[13px] font-semibold">Solana</text>
      <text x="549" y="116" textAnchor="middle" className="fill-white font-mono text-[11px]">memo in a public tx</text>
      <text x="549" y="136" textAnchor="middle" className="fill-white text-[12px] font-semibold">
        {verified === null ? "" : verified ? "✓ matches the chain" : "✗ does not match"}
      </text>
    </svg>
  );
}
