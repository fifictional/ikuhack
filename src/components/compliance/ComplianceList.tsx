import type { ComplianceDuty } from "@/lib/compliance/duties";
import { fmtDateTime } from "@/lib/ui/labels";
import { CopySentButton } from "./ComplianceActions";

const TONE = { breached: "text-danger", open: "text-warn", met: "text-ok" } as const;
const LABEL = { breached: "Breached", open: "Due", met: "Met" } as const;

/** Portfolio-level recurring compliance: gas safety (annual) and EICR (5-yearly) + the 28-day copy. */
export function ComplianceList({ duties }: { duties: ComplianceDuty[] }) {
  // Met duties stay out of the work list; the count proves they were done.
  const outstanding = duties.filter((d) => d.status !== "met");
  const breached = outstanding.filter((d) => d.status === "breached").length;
  const met = duties.length - outstanding.length;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Certificates &amp; safety checks</h2>
          <span className={`text-xs font-medium ${breached ? "text-danger" : "text-ok"}`}>
            {breached ? `${breached} breach${breached === 1 ? "" : "es"}` : "No breaches"}
            {met > 0 && <span className="text-muted"> · {met} up to date</span>}
          </span>
        </div>
        <p className="text-xs text-muted">Gas, electrical and the 28-day copy — whether or not a repair is reported.</p>
      </div>
      <ul className="divide-y divide-border">
        {outstanding.map((d) => (
          <li key={d.id} className="flex items-start justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{d.title}</p>
              <p className="text-xs text-muted">
                {d.propertyAddress} ·{" "}
                <a href={d.legalBasis.url} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                  {d.legalBasis.citation}
                </a>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className={`text-sm font-medium ${TONE[d.status]}`}>{LABEL[d.status]}</span>
              <p className="text-xs text-muted">{fmtDateTime(d.dueAt)}</p>
              {d.id.endsWith(":copy") && d.status !== "met" && <div className="mt-1"><CopySentButton propertyId={d.propertyId} kind={d.kind} /></div>}
            </div>
          </li>
        ))}
        {outstanding.length === 0 && <li className="py-2 text-sm text-ok">All recurring checks are up to date.</li>}
      </ul>
    </section>
  );
}
