import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCase, recompute } from "@/lib/cases/service";
import type { Category, Obligation } from "@/lib/domain/types";
import { CATEGORY_LABEL, PHASE_LABEL, describeEvent, fmtDateTime } from "@/lib/ui/labels";
import { Countdown } from "./Countdown";
import { LandlordActions } from "./LandlordActions";
import { TenantActions } from "./TenantActions";

/**
 * Shared case page for both parties: same facts, same clocks, same history.
 * Only the action panel differs by role.
 */
export async function CaseView({ caseId, role }: { caseId: string; role: "tenant" | "landlord" }) {
  await connection();
  // Re-project at the current (demo) time so clocks and breaches are never stale.
  await recompute(caseId).catch(() => notFound());
  const c = await getCase(caseId);
  if (!c) notFound();
  const s = c.state;
  const category = s.facts["issue.category"]?.value as Category | undefined;
  const open = s.obligations.filter((o) => o.status === "open" || o.status === "breached");
  const done = s.obligations.filter((o) => o.status === "met" || o.status === "met_late");
  const evidence = c.events.filter((e) => e.type === "EVIDENCE_ADDED");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-muted">{c.address} · {c.landlord_name}</p>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill>{PHASE_LABEL[s.phase]}</Pill>
            {category && <Pill>{CATEGORY_LABEL[category]}</Pill>}
            {s.facts["issue.severity"] && <Pill>Severity: {String(s.facts["issue.severity"].value)}</Pill>}
            {s.facts["household.vulnerable"]?.value === true && <Pill tone="warn">Vulnerable occupant</Pill>}
          </div>
        </header>

        <Section title="Who must do what, by when">
          {open.length === 0 && <p className="text-sm text-muted">No open duties.</p>}
          {open.map((o) => <ObligationRow key={o.id} o={o} now={s.computedAt} />)}
          {done.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">{done.length} completed</summary>
              {done.map((o) => <ObligationRow key={o.id} o={o} now={s.computedAt} />)}
            </details>
          )}
        </Section>

        {(s.conflicts.length > 0 || s.notes.length > 0) && (
          <Section title="Things to know">
            {s.conflicts.map((cf) => (
              <p key={cf.key} className="text-sm">
                ⚖️ Sources disagree on <b>{cf.key}</b>:{" "}
                {cf.candidates.map((b) => `${b.source.label ?? b.source.kind} → ${String(b.value)}`).join(" vs ")}.{" "}
                {cf.resolution === "safety_first" ? "Acting on the most severe until resolved." : "Using the most reliable source."}
              </p>
            ))}
            {s.notes.map((n) => <p key={n} className="text-sm">ℹ️ {n}</p>)}
          </Section>
        )}

        <Section title="How Docket's view changed">
          {c.revisions.length === 0 && <p className="text-sm text-muted">No changes yet.</p>}
          <ul className="space-y-2">
            {c.revisions.map((r, i) => (
              <li key={i} className="text-sm">
                <span className="mr-2 font-mono text-xs text-muted">{fmtDateTime(r.at.toISOString())}</span>
                <span className={r.kind === "obligation_abandoned" || r.kind === "obligation_breached" ? "text-danger" : ""}>{r.summary}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Full record">
          <ol className="space-y-1 border-l border-border pl-4">
            {c.events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="mr-2 font-mono text-xs text-muted">{fmtDateTime(e.at)}</span>
                <span className="mr-2 text-xs uppercase text-muted">{e.actor}</span>
                {describeEvent(e)}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <aside className="space-y-6">
        {role === "landlord" ? (
          <LandlordActions caseId={caseId} events={c.events} />
        ) : (
          <TenantActions caseId={caseId} escalationOptions={s.escalationOptions} phase={s.phase} />
        )}
        <Section title={`Evidence (${evidence.length})`}>
          <div className="grid grid-cols-3 gap-2">
            {evidence.map((e) =>
              e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={e.id} src={`/api/evidence/${e.evidenceId}`} alt={e.caption ?? "evidence"} className="aspect-square rounded object-cover" />
              ) : null,
            )}
          </div>
          <a href={`/api/cases/${caseId}/bundle`} className="block text-sm text-accent underline" target="_blank">
            Download evidence bundle (PDF)
          </a>
        </Section>
      </aside>
    </div>
  );
}

function ObligationRow({ o, now }: { o: Obligation; now: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">
          <span className="mr-2 text-xs uppercase text-muted">{o.party}</span>
          {o.title}
          {o.provisional && <span className="ml-2 text-xs text-warn">provisional</span>}
        </p>
        <p className="text-xs text-muted">
          {o.legalBasis.statutory ? "Legal duty" : "Docket target (not a legal deadline)"} · {o.legalBasis.citation}
          {o.pausedMs > 0 && ` · clock paused ${Math.round(o.pausedMs / 3_600_000)}h (missed access)`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {o.status === "open" || o.status === "breached" ? (
          <Countdown dueAt={o.dueAt} serverNow={now} />
        ) : (
          <span className="text-sm text-ok">{o.status === "met" ? "Met" : "Met late"}</span>
        )}
        <p className="text-xs text-muted">{fmtDateTime(o.dueAt)}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 ${tone === "warn" ? "border-warn text-warn" : "border-border text-muted"}`}>
      {children}
    </span>
  );
}
