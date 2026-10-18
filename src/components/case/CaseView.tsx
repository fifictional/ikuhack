import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCase, recompute } from "@/lib/cases/service";
import { getCachedChecks, getCaptureMethods } from "@/lib/evidence/authenticity";
import type { Category, Obligation, Severity } from "@/lib/domain/types";
import { FACT_PLAIN, describeEvent, factValuePlain, fmtDateTime, sourcePlain } from "@/lib/ui/labels";
import { type Locale, type MessageKey, type T, formatDateTime, plainDutyIn, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Countdown } from "./Countdown";
import { PhotoAuthenticity } from "./PhotoAuthenticity";
import { ListenButton } from "./ListenButton";
import { LandlordActions } from "./LandlordActions";
import { BeliefTimeline } from "./BeliefTimeline";
import { ObligationList } from "./ObligationList";
import { TenantActions } from "./TenantActions";

/**
 * Shared case page for both parties: same facts, same clocks, same history.
 * Only the action panel differs by role.
 */
export async function CaseView({ caseId, role }: { caseId: string; role: "tenant" | "landlord" }) {
  await connection();
  // Tenants see their chosen language; the landlord view, citations and the record stay English.
  const locale: Locale = role === "tenant" ? await getLocale() : "en";
  const t = translator(locale);
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
  const photoIds = evidence.flatMap((e) => (e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? [e.evidenceId] : []));
  // Landlord view: the verdict recorded at upload and how each photo was taken, loaded up front.
  const [checks, captures] = role === "landlord" ? await Promise.all([getCachedChecks(photoIds), getCaptureMethods(photoIds)]) : [{}, {}];
  // The single most pressing duty, for the tenant's "what happens next" card.
  const next = [...open].sort((a, b) => Number(b.status === "breached") - Number(a.status === "breached") || a.dueAt.localeCompare(b.dueAt))[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-muted">{c.address} · {c.landlord_name}</p>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill>{t(`phase.${s.phase}` as MessageKey)}</Pill>
            {category && <Pill>{t(`category.${category}` as MessageKey)}</Pill>}
            {severity && <Pill tone={severity === "emergency" ? "danger" : undefined}>{t(`severity.${severity}` as MessageKey)}</Pill>}
            {s.facts["household.vulnerable"]?.value === true && <Pill tone="warn">{t("case.vulnerable")}</Pill>}
          </div>
        </header>

        {role === "tenant" && <NextStep o={next} landlordName={c.landlord_name} now={s.computedAt} caseId={caseId} locale={locale} />}
        {role === "tenant" && locale !== "en" && (
          <p className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted">{t("case.englishNote")}</p>
        )}

        <Section title={role === "tenant" ? t("case.everythingDue") : "Who must do what, by when"}>
          {open.length === 0 && <p className="text-sm text-muted">{t("case.nothingDueShort")}</p>}
          <ObligationList obligations={open} now={s.computedAt} role={role} landlordName={c.landlord_name} />
          {done.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer py-2 text-muted">{t("case.doneCount", { n: done.length })}</summary>
              <ObligationList obligations={done} now={s.computedAt} role={role} landlordName={c.landlord_name} />
            </details>
          )}
        </Section>

        {(s.conflicts.length > 0 || s.notes.length > 0) && (
          <Section title={t("case.thingsToKnow")}>
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

        <Section title={role === "tenant" ? t("case.whatChanged") : "How Docket's view changed"}>
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

        <Section title={t("case.believed")}>
          <BeliefTimeline
            caseId={caseId}
            now={s.computedAt}
            openedAt={s.openedAt}
            revisions={c.revisions.map((r) => ({ at: r.at.toISOString() }))}
            landlordName={c.landlord_name}
          />
        </Section>

        <Section title={t("case.fullRecord")}>
          <details>
          <summary className="cursor-pointer text-sm text-muted">{t("case.entries", { n: c.events.length })}</summary>
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
        <Section title={t("case.evidence", { n: evidence.length })}>
          {role === "landlord" ? (
            <div className="space-y-2">
              {evidence.map((e) => (e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? <PhotoAuthenticity key={e.id} evidenceId={e.evidenceId} caption={e.caption} initial={checks[e.evidenceId]} capture={captures[e.evidenceId]} /> : null))}
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-2">
            {evidence.map((e) =>
              e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={e.id} src={`/api/evidence/${e.evidenceId}`} alt={e.caption ?? "evidence"} className="aspect-square rounded object-cover" />
              ) : null,
            )}
          </div>
          )}
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
            {t("case.bundle")}
          </a>
        </Section>
      </aside>
    </div>
  );
}

/** Tenant-only headline: the one thing that matters most right now. */
function NextStep({ o, landlordName, now, caseId, locale }: { o: Obligation | undefined; landlordName: string; now: string; caseId: string; locale: Locale }) {
  const t: T = translator(locale);
  if (!o) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t("case.whatNext")}</p>
        <p className="text-lg font-semibold">{t("case.nothingDue")}</p>
      </div>
    );
  }
  const breached = o.status === "breached";
  const duty = plainDutyIn(locale, o, landlordName);
  const date = formatDateTime(o.dueAt, locale);
  return (
    <div className={`rounded-xl border-2 p-4 ${breached ? "border-danger bg-surface" : "border-primary bg-primary-tint"}`}>
      <p className="text-sm text-muted">{breached ? t("case.deadlineMissed") : t("case.whatNext")}</p>
      <p className="text-lg font-semibold">{t(breached ? "case.wasDue" : "case.dueBy", { duty, date })}</p>
      <div className="mt-1 flex items-center gap-2">
        <Countdown dueAt={o.dueAt} serverNow={now} />
        <span className="text-xs text-muted">· {t(o.legalBasis.deadline === "law" ? "case.legalDeadline" : o.legalBasis.statutory ? "case.legalDutyTarget" : "case.docketTarget")}</span>
      </div>
      <div className="mt-2">
        {/* Listen speaks the English source; the TTS route translates it into the page's language. */}
        <ListenButton caseId={caseId} text={`${plainDutyIn("en", o, landlordName)} ${breached ? "was due" : "by"} ${fmtDateTime(o.dueAt)}.`} />
      </div>
      {breached && o.party === "landlord" && (
        <p className="mt-2 text-sm">{t("case.canEscalate")}</p>
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
