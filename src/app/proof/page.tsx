import { connection } from "next/server";
import { Suspense } from "react";
import { ProofFlow } from "@/components/proof/ProofFlow";
import { latestOnChain, proofTotals, recentBatches, type BatchSummary } from "@/lib/solana/proof";
import { fmtDateTime, fmtDay } from "@/lib/ui/labels";

export const metadata = { title: "Proof on Solana" };

export default function ProofPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Proof on Solana</h1>
        <p className="text-sm text-muted">
          Every photo, case log and compliance record is fingerprinted. The fingerprints are combined into one number and
          written to the Solana blockchain, so no one, including Docket, can change a date after the fact. This page re-reads
          the chain live.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Checking the chain…</p>}>
        <Proof />
      </Suspense>
    </div>
  );
}

/** [singular, plural] so counts read correctly ("1 inspection", "4 inspections"). */
const KIND_LABEL: Record<string, [string, string]> = {
  evidence: ["evidence file", "evidence files"],
  case_head: ["case log", "case logs"],
  compliance_record: ["inspection", "inspections"],
  compliance_copy: ["tenant copy", "tenant copies"],
  compliance_certificate: ["certificate", "certificates"],
};
const kindCount = (k: string, n: number) => `${n} ${KIND_LABEL[k]?.[n === 1 ? 0 : 1] ?? k}`;

async function Proof() {
  await connection();
  const [batches, totals] = await Promise.all([recentBatches(6), proofTotals()]);
  const latest = batches[0];
  const onChain = await latestOnChain(latest);
  const complianceTotal = batches.reduce(
    (n, b) => n + (b.byKind.compliance_record ?? 0) + (b.byKind.compliance_copy ?? 0) + (b.byKind.compliance_certificate ?? 0),
    0,
  );

  if (!latest) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        No records have been anchored yet. Records are anchored automatically every day.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Batches on-chain" value={totals.batches} />
        <Tile label="Fingerprints anchored" value={totals.leaves} />
        <Tile label="Compliance records" value={complianceTotal} />
        <Tile label="Last anchored" value={fmtDay(latest.createdAt.toISOString())} />
      </div>

      <section className="space-y-3 rounded-xl border-2 border-primary bg-primary-tint p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Latest batch</h2>
          <OnChainBadge check={onChain} />
        </div>
        <ProofFlow batch={latest} verified={onChain?.checked ? (onChain.matches ?? false) : null} />
        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <Row k="Anchored" v={fmtDateTime(latest.createdAt.toISOString())} />
          {onChain?.slot && <Row k="Solana slot" v={onChain.slot.toLocaleString("en-GB")} />}
          {onChain?.blockTime && <Row k="Block time (chain clock)" v={fmtDateTime(onChain.blockTime)} />}
          {onChain?.signer && <Row k="Signed by" v={`${onChain.signer.slice(0, 8)}…${onChain.signer.slice(-6)}`} mono />}
          <Row k="Merkle root" v={latest.root} mono wide />
        </dl>
        {latest.url && (
          <a href={latest.url} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-primary underline">
            Open this transaction on Solana Explorer ↗
          </a>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recent batches</h2>
        <ul className="divide-y divide-border">
          {batches.map((b) => <BatchRow key={b.id} b={b} />)}
        </ul>
      </section>

      <p className="text-sm text-muted">
        Have a photo or certificate? <a href="/verify" className="font-medium text-primary underline">Check it on the verify page</a>; it
        is hashed in your browser and never uploaded.
      </p>
    </>
  );

  function BatchRow({ b }: { b: BatchSummary }) {
    return (
      <li className="flex flex-wrap items-start justify-between gap-2 py-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs text-muted">{b.root}</p>
          <p className="text-xs text-muted">
            {fmtDateTime(b.createdAt.toISOString())} ·{" "}
            {Object.entries(b.byKind).map(([k, n]) => kindCount(k, n)).join(" · ")}
          </p>
        </div>
        {b.url && <a href={b.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-primary underline">Explorer ↗</a>}
      </li>
    );
  }
}

function OnChainBadge({ check }: { check: Awaited<ReturnType<typeof latestOnChain>> }) {
  if (!check) return null;
  if (!check.checked) return <span className="text-xs font-medium text-warn">Couldn&apos;t reach Solana just now</span>;
  return check.matches ? (
    <span className="rounded-full border border-ok px-2 py-0.5 text-xs font-medium text-ok">✓ Verified live on Solana</span>
  ) : (
    <span className="rounded-full border border-danger px-2 py-0.5 text-xs font-medium text-danger">✗ Chain does not match</span>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Row({ k, v, mono, wide }: { k: string; v: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-muted">{k}</dt>
      <dd className={`break-all ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}
