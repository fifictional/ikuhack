"use client";

import { useState } from "react";
import { DEMO } from "@/lib/demo";

/** Pitch-day control panel. Each button shows the agent adapting live. */
export function DemoPanel() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(label: string, url: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    setLog((l) => [`${label}: ${JSON.stringify(json)}`, ...l]);
    setBusy(false);
  }

  const demo = (body: unknown) => run(JSON.stringify(body), "/api/demo", body);

  // Healthy readings, then a damp spike, for the hero flat's bedroom.
  async function streamDamp() {
    const now = Date.now();
    const readings = Array.from({ length: 14 * 24 }, (_, i) => {
      const ts = new Date(now - (14 * 24 - i) * 3_600_000);
      const night = ts.getUTCHours() <= 6;
      return { room: "bedroom", ts: ts.toISOString(), humidity_pct: night ? 78 + Math.random() * 4 : 62, temp_c: night ? 15.5 : 18.5 };
    });
    await run("stream damp sensor data", "/api/sensors", { propertyId: DEMO.tenantPropertyId, readings });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Group title="Time">
        <B disabled={busy} onClick={() => demo({ action: "advance", hours: 24 })}>+1 day</B>
        <B disabled={busy} onClick={() => demo({ action: "advance", hours: 24 * 7 })}>+1 week</B>
        <B disabled={busy} onClick={() => demo({ action: "reset_clock" })}>Reset clock</B>
      </Group>
      <Group title="Law changes">
        <B disabled={busy} onClick={() => demo({ action: "commence", phaseId: "awaab-2" })}>Commence Awaab&apos;s Law phase 2 today</B>
        <B disabled={busy} onClick={() => demo({ action: "uncommence", phaseId: "awaab-2" })}>Undo</B>
      </Group>
      <Group title="Sensors (Tiger Data)">
        <B disabled={busy} onClick={streamDamp}>Stream 14 days of damp bedroom readings</B>
      </Group>
      <Group title="Evidence (Solana devnet)">
        <B disabled={busy} onClick={() => run("anchor", "/api/anchor")}>Anchor new evidence now</B>
      </Group>
      <Group title="ElevenLabs credits">
        <B disabled={busy} onClick={async () => {
          const u = await (await fetch("/api/voice/usage")).json();
          setLog((l) => [`voice usage: ${JSON.stringify(u)}`, ...l]);
        }}>Check remaining credits</B>
      </Group>
      <pre className="md:col-span-2 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-4 text-xs">{log.join("\n") || "—"}</pre>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function B(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:border-teal hover:text-teal disabled:opacity-50" />;
}
