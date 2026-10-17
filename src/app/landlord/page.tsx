import { connection } from "next/server";
import { Suspense } from "react";
import { CaseList } from "@/components/case/CaseList";
import { listCases } from "@/lib/cases/service";
import { getNow } from "@/lib/db/settings";
import { DEMO } from "@/lib/demo";

export default function LandlordDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Riverside Homes Housing Association</p>
        <h1 className="text-2xl font-semibold">Repairs compliance</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading portfolio…</p>}>
        <Portfolio />
      </Suspense>
    </div>
  );
}

async function Portfolio() {
  await connection();
  const [cases, now] = await Promise.all([listCases({ landlordId: DEMO.landlordId }), getNow()]);
  const obligations = cases.flatMap((c) => c.state?.obligations.filter((o) => o.party === "landlord" && o.legalBasis.statutory) ?? []);
  const breached = obligations.filter((o) => o.status === "breached").length;
  const dueToday = obligations.filter(
    (o) => o.status === "open" && new Date(o.dueAt).getTime() - now.getTime() < 86_400_000,
  ).length;
  const closed = obligations.filter((o) => o.status === "met" || o.status === "met_late");
  const onTime = closed.length ? Math.round((closed.filter((o) => o.status === "met").length / closed.length) * 100) : 100;

  // TODO(person B): sensor chart per property (GET /api/sensors) and breach trend from case_revisions.
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Open cases" value={cases.filter((c) => !["resolved", "closed"].includes(c.state?.phase ?? "")).length} />
        <Stat label="Legal deadlines missed" value={breached} tone={breached ? "danger" : undefined} />
        <Stat label="Due in 24h" value={dueToday} tone={dueToday ? "warn" : undefined} />
        <Stat label="Met on time" value={`${onTime}%`} />
      </div>
      <CaseList cases={cases} hrefBase="/landlord/cases" party="landlord" now={now.toISOString()} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-semibold ${tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}
