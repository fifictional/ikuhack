import { connection } from "next/server";
import { Suspense } from "react";
import { CaseList } from "@/components/case/CaseList";
import { ComplianceProofs } from "@/components/compliance/ComplianceProofs";
import { ComplianceList } from "@/components/compliance/ComplianceList";
import { listCases } from "@/lib/cases/service";
import { getComplianceDuties } from "@/lib/compliance/service";
import { getNow } from "@/lib/db/settings";
import { DEMO } from "@/lib/demo";
import { getComplianceProofs } from "@/lib/solana/proof";

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
  const [cases, now, compliance, proofs] = await Promise.all([
    listCases({ landlordId: DEMO.landlordId }),
    getNow(),
    getComplianceDuties(DEMO.landlordId),
    getComplianceProofs(DEMO.landlordId),
  ]);
  const properties = [...new Map(compliance.map((d) => [d.propertyId, { id: d.propertyId, address: d.propertyAddress }])).values()];
  // "Legal deadlines" means fixed periods set by law (e.g. Awaab's Law), not Docket's targets for "reasonable time" duties.
  const obligations = cases.flatMap((c) => c.state?.obligations.filter((o) => o.party === "landlord" && o.legalBasis.deadline === "law") ?? []);
  const breached = obligations.filter((o) => o.status === "breached").length;
  const dueToday = obligations.filter(
    (o) => o.status === "open" && new Date(o.dueAt).getTime() - now.getTime() < 86_400_000,
  ).length;
  const closed = obligations.filter((o) => o.status === "met" || o.status === "met_late");
  const onTime = closed.length ? Math.round((closed.filter((o) => o.status === "met").length / closed.length) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Open cases" value={cases.filter((c) => !["resolved", "closed"].includes(c.state?.phase ?? "")).length} />
        <Stat label="Legal deadlines missed" value={breached} tone={breached ? "danger" : undefined} />
        <Stat label="Due in 24h" value={dueToday} tone={dueToday ? "warn" : undefined} />
        <Stat label="Met on time" value={`${onTime}%`} />
      </div>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Repair cases</h2>
          <p className="text-xs text-muted">Issues tenants have reported, with their legal clocks.</p>
        </div>
        <CaseList cases={cases} hrefBase="/landlord/cases" party="landlord" now={now.toISOString()} />
      </section>
      <ComplianceList duties={compliance} />
      <ComplianceProofs proofs={proofs} properties={properties} />
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
