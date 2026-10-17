import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { CaseList } from "@/components/case/CaseList";
import { listCases } from "@/lib/cases/service";
import { getNow } from "@/lib/db/settings";
import { DEMO } from "@/lib/demo";

export default function TenantHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Flat 4, 12 Canal Street</p>
          <h1 className="text-2xl font-semibold">Your repairs</h1>
        </div>
        <Link href="/tenant/report" className="rounded-lg bg-primary font-semibold text-white hover:bg-primary-dark px-4 py-2">Report a problem</Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <TenantCases />
      </Suspense>
    </div>
  );
}

async function TenantCases() {
  await connection();
  const [cases, now] = await Promise.all([listCases({ tenantId: DEMO.tenantId }), getNow()]);
  return <CaseList cases={cases} hrefBase="/tenant/cases" party="tenant" now={now.toISOString()} />;
}
