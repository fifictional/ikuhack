import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCase, recompute } from "@/lib/cases/service";
import { getCachedChecks, getCaptureMethods } from "@/lib/evidence/authenticity";
import type { Category, Obligation, Severity } from "@/lib/domain/types";
import { FACT_PLAIN, describeEvent, factValuePlain, fmtDateTime, fmtTime, sourcePlain } from "@/lib/ui/labels";
import { type Locale, type MessageKey, type T, formatDateTime, plainDutyIn, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { buildDutyTypes, describeRevision, groupByDay } from "@/lib/ui/revisions";
import { Countdown } from "./Countdown";
import { PhotoAuthenticity } from "./PhotoAuthenticity";
import { LandlordActions } from "./LandlordActions";
import { ListenButton } from "./ListenButton";
import { BeliefTimeline } from "./BeliefTimeline";
import { ObligationList } from "./ObligationList";
import { TenantActions } from "./TenantActions";
import { InfoIcon, ScaleIcon } from "@/components/icons";

/**
 * Shared case page for both parties: same facts, same clocks, same history.
 * Only the action panel differs by role.
 */
export async function CaseView({ caseId, role }: { caseId: string; role: "tenant" | "landlord" }) {
  await connection();
  // Tenants see their chosen language; the landlord view, citations and the record stay English.
  const locale: Locale = role === "tenant" ? await getLocale() : "en";
  const t = translator(locale);
  const landlordWord = t("case.landlord");
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
  const vulnerable = s.facts["household.vulnerable"]?.value === true;
  const photoIds = evidence.flatMap((e) => (e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? [e.evidenceId] : []));
  // Landlord view: the verdict recorded at upload and how each photo was taken, loaded up front.
  const [checks, captures] = role === "landlord" ? await Promise.all([getCachedChecks(photoIds), getCaptureMethods(photoIds)]) : [{}, {}];
  // The single most pressing duty, for the tenant's alert.
  const next = [...open].sort((a, b) => Number(b.status === "breached") - Number(a.status === "breached") || a.dueAt.localeCompare(b.dueAt))[0];
  const overdueCount = open.filter((o) => o.status === "breached").length;
  const dutyTypes = buildDutyTypes(c.revisions);
  const revisionGroups = groupByDay(c.revisions);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      {/* Full-width header: the landlord's name appears here, and only here. */}
      <header className="space-y-1 lg:col-span-2">
        <p className="text-sm text-muted">
          {c.address} · {t("case.landlordLabel", { name: c.landlord_name })}
        </p>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Emergency first. */}
          {severity && <Pill tone={severity === "emergency" ? "danger" : undefined}>{t(`severity.${severity}` as MessageKey)}</Pill>}
          <Pill>{t(`phase.${s.phase}` as MessageKey)}</Pill>
          {category && <Pill>{t(`category.${category}` as MessageKey)}</Pill>}
          {vulnerable && <Pill tone="warn">{t("case.vulnerable")}</Pill>}
        </div>
      </header>

      {/* Main column. `contents` on mobile lets its children take part in the page order. */}
      <div className="contents lg:block lg:space-y-6">
        {role === "tenant" && (
          <div className="order-1 space-y-3">
            <NextStep o={next} now={s.computedAt} caseId={caseId} locale={locale} />
            {locale !== "en" && (
              <p className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted">{t("case.englishNote")}</p>
            )}
          </div>
        )}

        <div className="order-3">
          <Section
            title={role === "tenant" ? t("case.everythingDue") : "Who must do what, by when"}
            right={overdueCount > 0 ? <span className="shrink-0 text-xs font-semibold text-danger">{t("case.overdueCount", { n: overdueCount })}</span> : undefined}
          >
            {open.length === 0 && <p className="text-sm text-muted">{t("case.nothingDueShort")}</p>}
            <ObligationList obligations={open} now={s.computedAt} role={role} landlordName={landlordWord} />
            {done.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer py-2 text-muted">{t("case.doneCount", { n: done.length })}</summary>
                <ObligationList obligations={done} now={s.computedAt} role={role} landlordName={landlordWord} />
              </details>
            )}
          </Section>
        </div>

        <div className="order-4">
          <Section
            title={role === "tenant" ? t("case.whatChanged") : "How Docket's view changed"}
            right={<ListenButton caseId={caseId} text={c.revisions.map((r) => r.summary).join(" ")} label={t("listen.all")} />}
          >
            {c.revisions.length === 0 && <p className="text-sm text-muted">{t("case.noChanges")}</p>}
            <div className="space-y-4">
              {revisionGroups.map((g) => (
                <div key={g.day} className="space-y-2">
                  <p className="text-xs font-semibold text-muted">{g.day}</p>
                  <ul className="space-y-2">
                    {g.items.map((r, i) => {
                      const d = describeRevision(r, dutyTypes);
                      return (
                        <li key={`${r.at.toISOString()}-${i}`} className="flex gap-3">
                          <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-muted">{fmtTime(r.at.toISOString())}</span>
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              d.tone === "danger" ? "bg-danger" : "border border-muted bg-transparent"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${d.tone === "danger" ? "text-danger" : ""}`}>{d.title}</p>
                            {d.description && <p className="truncate text-xs text-muted">{d.description}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {(s.conflicts.length > 0 || s.notes.length > 0) && (
          <div className="order-5">
            <Section title={t("case.thingsToKnow")}>
              {s.conflicts.map((cf) => (
                <p key={cf.key} className="text-sm">
                  <ScaleIcon className="me-1.5 align-[-3px] text-muted" />
                  Sources disagree on <b>{FACT_PLAIN[cf.key]}</b>:{" "}
                  {cf.candidates.map((b) => `${sourcePlain(b.source)} says "${factValuePlain(b.value)}"`).join(" vs ")}.{" "}
                  {cf.resolution === "safety_first"
                    ? "Docket takes the safer view until this is resolved."
                    : "Docket goes with the most reliable source."}
                </p>
              ))}
              {s.notes.map((n) => (
                <p key={n} className="text-sm">
                  <InfoIcon className="me-1.5 align-[-3px] text-muted" />
                  {n}
                </p>
              ))}
            </Section>
          </div>
        )}

        <div className="order-7">
          <Section title={t("case.believed")}>
            <BeliefTimeline
              caseId={caseId}
              now={s.computedAt}
              openedAt={s.openedAt}
              revisions={c.revisions.map((r) => ({ at: r.at.toISOString() }))}
              landlordName="Landlord"
              breachedNow={overdueCount > 0}
            />
          </Section>
        </div>

        <div className="order-8">
          <details className="group rounded-xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("case.fullRecord")}</h2>
              <span className="text-xs text-muted">
                {t("case.entries", { n: c.events.length })} ·{" "}
                <span className="group-open:hidden">{t("case.show")}</span>
                <span className="hidden group-open:inline">{t("case.hide")}</span>
              </span>
            </summary>
            <ol className="space-y-1 border-t border-border px-4 py-3">
              {c.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="mr-2 font-mono text-xs text-muted">{fmtDateTime(e.at)}</span>
                  <span className="mr-2 text-xs uppercase text-muted">{e.actor}</span>
                  {describeEvent(e)}
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>

      {/* Sidebar. `contents` on mobile lets its children fall into the page order. */}
      <div className="contents lg:block lg:space-y-6">
        <div className="order-2">
          {role === "landlord" ? (
            <LandlordActions caseId={caseId} events={c.events} />
          ) : (
            <TenantActions
              caseId={caseId}
              escalationOptions={s.escalationOptions}
              phase={s.phase}
              vulnerable={vulnerable}
            />
          )}
        </div>

        <div className="order-6">
          <Section title={t("case.evidence", { n: evidence.length })}>
            {evidence.length === 0 && (
              <p className="rounded-lg border border-border bg-background p-3 text-sm text-muted">
                {t("case.noPhotos")}
              </p>
            )}
            {role === "landlord" ? (
              <div className="space-y-2">
                {evidence.map((e) =>
                  e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? (
                    <PhotoAuthenticity
                      key={e.id}
                      evidenceId={e.evidenceId}
                      caption={e.caption}
                      initial={checks[e.evidenceId]}
                      capture={captures[e.evidenceId]}
                    />
                  ) : null,
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {evidence.map((e) =>
                  e.type === "EVIDENCE_ADDED" && e.kind === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={e.id}
                      src={`/api/evidence/${e.evidenceId}`}
                      alt={e.caption ?? "evidence"}
                      className="aspect-square rounded object-cover"
                    />
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
        </div>
      </div>
    </div>
  );
}

/** Tenant-only headline: the one thing that matters most right now. */
function NextStep({ o, now, caseId, locale }: { o: Obligation | undefined; now: string; caseId: string; locale: Locale }) {
  const t: T = translator(locale);
  if (!o) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t("case.whatNext")}</p>
        <p className="text-lg font-semibold">{t("case.nothingDue")}</p>
      </div>
    );
  }

  const breached = o.status === "breached" && o.party === "landlord";
  if (breached) {
    return (
      <div className="rounded-xl border-2 border-danger bg-surface p-4">
        <p className="text-lg font-semibold">{t("case.shouldHaveFixed", { date: formatDateTime(o.dueAt, locale) })}</p>
        <div className="mt-2 flex items-center gap-3">
          <Countdown dueAt={o.dueAt} serverNow={now} />
          <ListenButton
            caseId={caseId}
            text={`Your landlord should have fixed this by ${fmtDateTime(o.dueAt)}. You can now escalate this.`}
          />
        </div>
        <div className="my-3 border-t border-border" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{t("case.canEscalateNow")}</p>
          <a href="#escalate" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            {t("case.seeOptions")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary bg-primary-tint p-4">
      <p className="text-sm text-muted">{t("case.whatNext")}</p>
      <p className="text-lg font-semibold">
        {t("case.dueBy", { duty: plainDutyIn(locale, o, t("case.landlord")), date: formatDateTime(o.dueAt, locale) })}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Countdown dueAt={o.dueAt} serverNow={now} />
        <span className="text-xs text-muted">
          · {t(o.legalBasis.deadline === "law" ? "case.legalDeadline" : o.legalBasis.statutory ? "case.legalDutyTarget" : "case.docketTarget")}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "warn" | "danger" }) {
  const cls = tone === "danger" ? "border-danger text-danger" : tone === "warn" ? "border-warn text-warn" : "border-border text-muted";
  return <span className={`rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}
