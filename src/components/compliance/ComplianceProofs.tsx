import type { ComplianceProof } from "@/lib/solana/proof";
import { fmtDateTime } from "@/lib/ui/labels";
import { AnchorNowButton, KIND_LABEL, RecordInspection } from "./ComplianceActions";

function Anchored({ a, label }: { a: ComplianceProof["record"]; label: string }) {
  if (!a) return <span className="text-xs text-muted">{label}: waiting to anchor</span>;
  const body = <>✓ {label} anchored {fmtDateTime(a.anchoredAt.toISOString())}</>;
  return a.url ? (
    <a href={a.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-ok underline">{body} ↗</a>
  ) : (
    <span className="text-xs font-medium text-ok">{body}</span>
  );
}

/** Every inspection on file, with its on-chain proof. This is what "provable compliance" looks like. */
export function ComplianceProofs({ proofs, properties }: { proofs: ComplianceProof[]; properties: { id: string; address: string }[] }) {
  const anchored = proofs.filter((p) => p.record).length;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Proof of compliance</h2>
          <p className="text-xs text-muted">
            Each inspection and each &ldquo;copy given to the tenant&rdquo; is fingerprinted and anchored on Solana, so the dates can&apos;t be changed later.{" "}
            <a href="/proof" className="font-medium text-primary underline">See the proof</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium">{anchored} of {proofs.length} anchored</span>
          <AnchorNowButton />
        </div>
      </div>
      <RecordInspection properties={properties} />
      <ul className="divide-y divide-border">
        {proofs.slice(0, 8).map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{KIND_LABEL[p.kind]}{p.hasCertificate && <span className="ml-2 text-xs font-normal text-muted">certificate attached</span>}</p>
              <p className="text-xs text-muted">{p.address} · inspected {fmtDateTime(p.performedAt.toISOString())}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              <Anchored a={p.record} label="Record" />
              {p.copySentAt ? <Anchored a={p.copy} label="Tenant copy" /> : <span className="text-xs text-muted">Tenant copy not yet sent</span>}
            </div>
          </li>
        ))}
        {proofs.length === 0 && <li className="py-2 text-sm text-muted">No inspections recorded yet.</li>}
      </ul>
    </section>
  );
}
