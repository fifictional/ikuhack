import { connection } from "next/server";
import { Suspense } from "react";
import { VerifyForm } from "@/components/verify/VerifyForm";
import { explorerUrl, listAnchors } from "@/lib/solana/anchor";
import { fmtDateTime } from "@/lib/ui/labels";

export const metadata = { title: "Verify a record" };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Verify a record</h1>
        <p className="text-sm text-muted">
          Drop in any photo or document from a Docket bundle. We hash it in your browser and check it against the
          fingerprint anchored on Solana — proving it hasn&apos;t been altered since it was logged.
        </p>
      </div>
      <VerifyForm />
      <Suspense fallback={<p className="text-sm text-muted">Loading anchored batches…</p>}>
        <RecentAnchors />
      </Suspense>
    </div>
  );
}

async function RecentAnchors() {
  await connection();
  const rows = await listAnchors(5);
  return (
    <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recent anchored batches</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No records have been anchored yet. Records are anchored automatically every day.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-xs text-muted">{a.merkle_root}</p>
                <p className="text-xs text-muted">
                  {a.leaf_count} {a.leaf_count === 1 ? "record" : "records"} · {fmtDateTime(new Date(a.created_at).toISOString())}
                </p>
              </div>
              {a.tx_signature && (
                <a
                  href={explorerUrl(a.tx_signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-medium text-primary underline"
                >
                  Explorer ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
