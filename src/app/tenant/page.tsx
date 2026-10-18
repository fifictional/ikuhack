import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { CaseList } from "@/components/case/CaseList";
import { listCases } from "@/lib/cases/service";
import { getNow } from "@/lib/db/settings";
import { DEMO } from "@/lib/demo";
import { T } from "@/components/i18n/I18n";
import { getLocale } from "@/lib/i18n/server";
import { tenantHomeAddress } from "@/lib/people";

export const metadata = { title: "Your repairs" };

export default function TenantHome() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Suspense fallback={<p className="h-5" />}>
            <HomeAddress />
          </Suspense>
          <h1 className="text-2xl font-semibold"><T k="tenantHome.title" /></h1>
        </div>
        <Link href="/tenant/report" className="rounded-lg bg-primary font-semibold text-white hover:bg-primary-dark px-4 py-2"><T k="tenantHome.report" /></Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted"><T k="common.loading" /></p>}>
        <TenantCases />
      </Suspense>
    </div>
  );
}

async function HomeAddress() {
  const address = await tenantHomeAddress(DEMO.tenantId);
  return address ? <p className="text-sm text-muted">{address}</p> : null;
}

async function TenantCases() {
  await connection();
  const [cases, now, locale] = await Promise.all([listCases({ tenantId: DEMO.tenantId }), getNow(), getLocale()]);
  return <CaseList cases={cases} hrefBase="/tenant/cases" party="tenant" now={now.toISOString()} locale={locale} />;
}
