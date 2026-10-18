import Link from "next/link";
import type { CaseState, Category } from "@/lib/domain/types";
import { type Locale, type MessageKey, dutyActionIn, formatDateTime, translator } from "@/lib/i18n";
import { Countdown } from "./Countdown";

interface Row {
  id: string;
  title: string;
  address: string;
  state: CaseState | null;
}

/** Case list sorted by most urgent open duty; breaches first. */
/** `locale` translates the tenant's list; the landlord's list stays English. */
export function CaseList({ cases, hrefBase, party, now, locale = "en" }: { cases: Row[]; hrefBase: string; party: "tenant" | "landlord"; now: string; locale?: Locale }) {
  const t = translator(locale);
  const withNext = cases.map((c) => {
    const next = c.state?.obligations
      .filter((o) => o.party === "landlord" && (o.status === "open" || o.status === "breached"))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    return { ...c, next };
  });
  withNext.sort((a, b) => (a.next?.dueAt ?? "9").localeCompare(b.next?.dueAt ?? "9"));

  if (cases.length === 0) return <p className="text-sm text-muted">{t("tenantHome.empty")}</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {withNext.map((c) => {
        const category = c.state?.facts["issue.category"]?.value as Category | undefined;
        return (
          <li key={c.id}>
            <Link href={`${hrefBase}/${c.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-background">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted">
                  {party === "landlord" && `${c.address} · `}
                  {category ? t(`category.${category}` as MessageKey) : t("tenantHome.uncategorised")} · {c.state ? t(`phase.${c.state.phase}` as MessageKey) : "—"}
                </p>
              </div>
              {c.next && c.state && (
                <div className="text-end">
                  <Countdown dueAt={c.next.dueAt} serverNow={now} />
                  <p className="text-xs text-muted">{party === "tenant" ? dutyActionIn(locale, c.next) : c.next.title} · {formatDateTime(c.next.dueAt, locale)}</p>
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
