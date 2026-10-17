import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCase, recompute } from "@/lib/cases/service";
import type { Category, Obligation, Severity } from "@/lib/domain/types";
import { CATEGORY_LABEL, FACT_PLAIN, PHASE_LABEL, SEVERITY_PLAIN, describeEvent, factValuePlain, deadlineLabel, fmtDateTime, plainDuty, sourcePlain } from "@/lib/ui/labels";
import { Countdown } from "./Countdown";
import { ListenButton } from "./ListenButton";
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
  const severity = s.facts["issue.severity"]?.value as Severity | undefined;
  // The single most pressing duty, for the tenant's "what happens next" card.
  const next = [...open].sort((a, b) => Number(b.status === "breached") - Number(a.status === "breached") || a.dueAt.localeCompare(b.dueAt))[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-muted">{c.address} · {c.landlord_name}</p>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill>{PHASE_LABEL[s.phase]}</Pill>
            {category && <Pill>{CATEGORY_LABEL[category]}</Pill>}
            {severity && <Pill tone={severity === "emergency" ? "danger" : undefined}>{SEVERITY_PLAIN[severity]}</Pill>}
            {s.facts["household.vulnerable"]?.value === true && <Pill tone="warn">Vulnerable occupant</Pill>}
          </div>
        </header>

        {role === "tenant" && <NextStep o={next} landlordName={c.landlord_name} now={s.computedAt} caseId={caseId} />}

        <Section title={role === "tenant" ? "Everything that's due" : "Who must do what, by when"}>
          {open.length === 0 && <p className="text-sm text-muted">Nothing is due right now.</p>}
          {open.map((o) => <ObligationRow key={o.id} o={o} now={s.computedAt} role={role} landlordName={c.landlord_name} />)}
          {done.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer py-2 text-muted">{done.length} done</summary>
              {done.map((o) => <ObligationRow key={o.id} o={o} now={s.computedAt} role={role} landlordName={c.landlord_name} />)}
            </details>
          )}
        </Section>

        {(s.conflicts.length > 0 || s.notes.length > 0) && (
          <Section title="Things to know">
            {s.conflicts.map((cf) => (
              <p key={cf.key} className="text-sm">
                ⚖️ Sources disagree on <b>{FACT_PLAIN[cf.key]}</b>:{" "}
                {cf.candidates.map((b) => `${sourcePlain(b.source)} says "${factValuePlain(b.value)}"`).join(" vs ")}.{" "}
                {cf.resolution === "safety_first" ? "Docket takes the safer view until this is resolved." : "Docket goes with the most reliable source."}
              </p>
            ))}
            {s.notes.map((n) => <p key={n} className="text-sm">ℹ️ {n}</p>)}
          </Section>
        )}

        <Section title={role === "tenant" ? "What changed and why" : "How Docket's view changed"}>
          {c.revisions.length === 0 && <p className="text-sm text-muted">No changes yet.</p>}
          <ul className="space-y-2">
            {c.revisions.map((r, i) => (
              <li key={i} className="text-sm">
                <span className="mr-2 font-mono text-xs text-muted">{fmtDateTime(r.at.toISOString())}</span>
                <span className={r.kind === "obligation_breached" ? "text-danger" : r.kind === "obligation_abandoned" || r.kind === "obligation_reopened" ? "text-highlight-dark" : ""}>{r.summary}</span>
                {role === "tenant" && i < 3 && <span className="ml-2 align-middle"><ListenButton caseId={caseId} text={r.summary.slice(0, 600)} /></span>}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Full record">
          <details>
          <summary className="cursor-pointer text-sm text-muted">{c.events.length} timestamped entries — tap to show</summary>
          <ol className="mt-3 space-y-1 border-l border-border pl-4">
            {c.events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="mr-2 font-mono text-xs text-muted">{fmtDateTime(e.at)}</span>
                <span className="mr-2 text-xs uppercase text-muted">{e.actor}</span>
                {describeEvent(e)}
              </li>
            ))}
          </ol>
          </details>
        </Section>
      </div>

      <aside className="space-y-6">
        {role === "landlord" ? (
          <LandlordActions caseId={caseId} events={c.events} />
        ) : (
          <TenantActions caseId={caseId} escalationOptions={s.escalationOptions} phase={s.phase} vulnerable={s.facts["household.vulnerable"]?.value === true} />
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
          {evidence.some((e) => e.type === "EVIDENCE_ADDED" && e.kind !== "photo") && (
            <ul className="space-y-1 text-sm">
              {evidence.map((e) =>
                e.type === "EVIDENCE_ADDED" && e.kind !== "photo" ? (
                  <li key={e.id}>
                    <a href={`/api/evidence/${e.evidenceId}`} target="_blank" className="font-medium text-primary underline">
                      {e.caption ?? e.kind}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          )}
          <a href={`/api/cases/${caseId}/bundle`} className="block text-sm font-medium text-primary underline" target="_blank">
            Download evidence bundle (PDF)
          </a>
        </Section>
      </aside>
    </div>
  );
}

function ObligationRow({ o, now, role, landlordName }: { o: Obligation; now: string; role: "tenant" | "landlord"; landlordName: string }) {
  const kind = deadlineLabel(o);
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {role === "tenant" ? (
            plainDuty(o, landlordName)
          ) : (
            <><span className="mr-2 text-xs uppercase text-muted">{o.party}</span>{o.title}</>
          )}
          {o.provisional && <span className="ml-2 text-xs text-warn">{role === "tenant" ? "being checked" : "provisional"}</span>}
        </p>
        {role === "tenant" ? (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer py-1">{kind} · why?</summary>
            <p>{o.reason}</p>
            <p className="mt-1">
              {o.legalBasis.url ? (
                <a href={o.legalBasis.url} target="_blank" rel="noreferrer" className="text-primary underline">{o.legalBasis.citation}</a>
              ) : (
                o.legalBasis.citation
              )}
            </p>
          </details>
        ) : (
          <p className="text-xs text-muted">
            {kind} ·{" "}
            {o.legalBasis.url ? (
              <a href={o.legalBasis.url} target="_blank" rel="noreferrer" className="underline hover:text-primary">{o.legalBasis.citation}</a>
            ) : (
              o.legalBasis.citation
            )}
          </p>
        )}
        {o.pausedMs > 0 && <p className="text-xs text-muted">Clock paused {Math.round(o.pausedMs / 3_600_000)}h after a missed appointment</p>}
      </div>
      <div className="shrink-0 text-right">
        {o.status === "open" || o.status === "breached" ? (
          <Countdown dueAt={o.dueAt} serverNow={now} />
        ) : (
          <span className="text-sm text-ok">{o.status === "met" ? "Done on time" : "Done late"}</span>
        )}
        <p className="text-xs text-muted">{fmtDateTime(o.dueAt)}</p>
      </div>
    </div>
  );
}

/** Tenant-only headline: the one thing that matters most right now. */
function NextStep({ o, landlordName, now, caseId }: { o: Obligation | undefined; landlordName: string; now: string; caseId: string }) {
  if (!o) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">What happens next</p>
        <p className="text-lg font-semibold">Nothing is due right now. We&apos;ll update you when anything changes.</p>
      </div>
    );
  }
  const breached = o.status === "breached";
  return (
    <div className={`rounded-xl border-2 p-4 ${breached ? "border-danger bg-surface" : "border-primary bg-primary-tint"}`}>
      <p className="text-sm text-muted">{breached ? "Deadline missed" : "What happens next"}</p>
      <p className="text-lg font-semibold">
        {plainDuty(o, landlordName)} {breached ? "— this was due" : "by"} {fmtDateTime(o.dueAt)}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Countdown dueAt={o.dueAt} serverNow={now} />
        <span className="text-xs text-muted">· {o.legalBasis.deadline === "law" ? "legal deadline" : o.legalBasis.statutory ? "legal duty, Docket target time" : "Docket target"}</span>
      </div>
      <div className="mt-2">
        <ListenButton caseId={caseId} text={`${plainDuty(o, landlordName)} ${breached ? "was due" : "by"} ${fmtDateTime(o.dueAt)}.`} />
      </div>
      {breached && o.party === "landlord" && (
        <p className="mt-2 text-sm">You can escalate this — see the options under <b>Your actions</b>.</p>
      )}
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

function Pill({ children, tone }: { children: React.ReactNode; tone?: "warn" | "danger" }) {
  const cls = tone === "danger" ? "border-danger text-danger" : tone === "warn" ? "border-warn text-warn" : "border-border text-muted";
  return (
    <span className={`rounded-full border px-2 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}
