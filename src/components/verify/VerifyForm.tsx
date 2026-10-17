"use client";

import { useState } from "react";

type Result =
  | { anchored: false }
  | {
      anchored: true; valid: boolean; root: string; anchoredAt: string; url: string | null; kind: string;
      signature: string | null; proof: string[];
      onChain?: { checked: boolean; matches?: boolean; slot?: number; error?: string };
    };

const KIND: Record<string, string> = {
  case_head: "case log",
  evidence: "evidence file",
  compliance_record: "compliance inspection record",
  compliance_copy: "tenant copy timestamp",
  compliance_certificate: "compliance certificate",
};

/** Hashes the file locally (it never leaves the browser) and asks the server for its Merkle proof. */
export function VerifyForm() {
  const [hash, setHash] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function check(file: File) {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setHash(hex);
    setResult(await (await fetch(`/api/verify/${hex}`)).json());
  }

  return (
    <div className="space-y-4">
      <input type="file" onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
      {hash && <p className="break-all font-mono text-xs text-muted">SHA-256 {hash}</p>}
      {result && !result.anchored && (
        <p className="text-sm text-warn">
          Not found in any anchored batch yet. Anchor the case from /demo, or wait for the daily cron.
        </p>
      )}
      {result?.anchored && (
        <div className={`space-y-1 rounded-xl border p-4 ${result.valid ? "border-ok" : "border-danger"}`}>
          <p className={`font-medium ${result.valid ? "text-ok" : "text-danger"}`}>
            {result.valid ? "✓ Unaltered since it was logged" : "✗ Proof failed"}
          </p>
          <p className="text-sm text-muted">Anchored {new Date(result.anchoredAt).toLocaleString("en-GB")}</p>
          <p className="text-xs text-muted">Record type: {KIND[result.kind] ?? result.kind}</p>
          {result.onChain?.checked && (
            <p className={`text-sm font-medium ${result.onChain.matches ? "text-ok" : "text-danger"}`}>
              {result.onChain.matches ? `✓ Confirmed on Solana (slot ${result.onChain.slot?.toLocaleString("en-GB")})` : "✗ The Solana record does not match"}
            </p>
          )}
          {result.onChain && !result.onChain.checked && <p className="text-xs text-warn">Couldn&apos;t reach Solana to confirm just now.</p>}
          <p className="break-all font-mono text-xs text-muted">Merkle root {result.root}</p>
          <button
            onClick={() => {
              const file = new Blob([JSON.stringify({ sha256: hash, kind: result.kind, merklePath: result.proof, merkleRoot: result.root, solanaTx: result.signature, how: "Hash pairs in sorted order up the path (sha256 of the concatenated bytes) to reach merkleRoot; the Solana memo must read docket:v1:<merkleRoot>." }, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(file);
              a.download = `docket-proof-${hash?.slice(0, 8)}.json`;
              a.click();
            }}
            className="block text-sm font-medium text-primary underline"
          >
            Download proof file
          </button>
          {result.url && (
            <a href={result.url} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-primary underline">
              View on Solana Explorer ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
