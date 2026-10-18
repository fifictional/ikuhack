import { connection } from "next/server";
import { Suspense } from "react";
import { ComplianceProofs } from "@/components/compliance/ComplianceProofs";
import { getComplianceDuties } from "@/lib/compliance/service";
import { DEMO } from "@/lib/demo";
import { getComplianceProofs } from "@/lib/solana/proof";

export const metadata = { title: "Proof of compliance" };

/**
 * The evidence side: every inspection fingerprinted and anchored on Solana. This is the only
 * landlord page that reads the chain, which is why it has its own route.
 */
export default function LandlordProofPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading proofs…</p>}>
      <Proofs />
    </Suspense>
  );
}

async function Proofs() {
  await connection();
  const [proofs, compliance] = await Promise.all([
    getComplianceProofs(DEMO.landlordId),
    getComplianceDuties(DEMO.landlordId),
  ]);
  // The "record inspection" form needs the list of properties to choose from.
  const properties = [...new Map(compliance.map((d) => [d.propertyId, { id: d.propertyId, address: d.propertyAddress }])).values()];
  return <ComplianceProofs proofs={proofs} properties={properties} />;
}
