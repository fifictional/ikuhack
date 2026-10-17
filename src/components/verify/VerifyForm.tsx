"use client";

import { useState } from "react";

type Result =
  | { anchored: false }
  | { anchored: true; valid: boolean; root: string; anchoredAt: string; url: string | null; kind: string };

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
      {result && !result.anchored && <p className="text-warn">Not found in any anchored batch (yet).</p>}
      {result?.anchored && (
        <div className={`rounded-xl border p-4 ${result.valid ? "border-ok" : "border-danger"}`}>
          <p className="font-medium">{result.valid ? "✓ Unaltered since it was logged" : "✗ Proof failed"}</p>
          <p className="text-sm text-muted">Anchored {new Date(result.anchoredAt).toLocaleString("en-GB")}</p>
          {result.url && <a href={result.url} target="_blank" className="text-sm text-accent underline">View on Solana Explorer</a>}
        </div>
      )}
    </div>
  );
}
