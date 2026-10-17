import { connection } from "next/server";
import { Suspense } from "react";
import { ComplianceList } from "@/components/compliance/ComplianceList";
import { getComplianceDuties } from "@/lib/compliance/service";
import { DEMO } from "@/lib/demo";

export const metadata = { title: "Certificates & safety checks — Docket" };

/**
 * The recurring, portfolio-level duties: what the landlord owes whether or not a repair is
 * ever reported. Separate route so the overview doesn't pay for this read.
 */
export default function LandlordCertificatesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading certificates…</p>}>
      <Duties />
    </Suspense>
  );
}

async function Duties() {
  await connection();
  const duties = await getComplianceDuties(DEMO.landlordId);
  return <ComplianceList duties={duties} />;
}
