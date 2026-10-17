"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export const KIND_LABEL = { gas_safety: "Gas safety record", eicr: "Electrical report (EICR)" } as const;

/** Small client helper: POST, surface errors, refresh the server components. */
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  async function run(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  }
  return { busy, error, run };
}

/** Landlord logs an inspection and attaches the certificate; it's hashed and anchored on Solana in the background. */
export function RecordInspection({ properties }: { properties: { id: string; address: string }[] }) {
  const { busy, error, run } = useAction();
  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        void run(() => fetch("/api/compliance", { method: "POST", body: new FormData(form) })).then(() => form.reset());
      }}
    >
      <p className="text-sm font-medium">Record an inspection</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select name="propertyId" required aria-label="Property" className="rounded-lg border border-border bg-surface p-2 text-sm">
          {properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
        <select name="kind" aria-label="Type" className="rounded-lg border border-border bg-surface p-2 text-sm">
          <option value="gas_safety">{KIND_LABEL.gas_safety}</option>
          <option value="eicr">{KIND_LABEL.eicr}</option>
        </select>
        <input name="performedAt" type="date" aria-label="Date of inspection" className="rounded-lg border border-border bg-surface p-2 text-sm" />
      </div>
      <input name="certificate" type="file" accept="application/pdf,image/*" aria-label="Certificate" className="block w-full text-sm" />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          {busy ? "Saving…" : "Save and anchor"}
        </button>
        {error && <span role="alert" className="text-xs text-danger">{error}</span>}
      </div>
    </form>
  );
}

/** Marks the tenant's copy as given; the timestamp is anchored. */
export function CopySentButton({ propertyId, kind }: { propertyId: string; kind: "gas_safety" | "eicr" }) {
  const { busy, error, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        disabled={busy}
        onClick={() => run(() => fetch("/api/compliance/copy-sent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId, kind }) }))}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-primary disabled:opacity-50"
      >
        {busy ? "Saving…" : "Mark copy sent"}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}

/** Anchors anything pending right now (the cron does it daily). */
export function AnchorNowButton() {
  const { busy, error, run } = useAction();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={busy}
        onClick={() => run(() => fetch("/api/anchor", { method: "POST" }))}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-primary disabled:opacity-50"
      >
        {busy ? "Anchoring…" : "Anchor now"}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
