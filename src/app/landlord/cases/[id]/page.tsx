import { Suspense } from "react";
import { CaseView } from "@/components/case/CaseView";

export default async function LandlordCasePage({ params }: PageProps<"/landlord/cases/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading case…</p>}>
      <CaseView caseId={id} role="landlord" />
    </Suspense>
  );
}
