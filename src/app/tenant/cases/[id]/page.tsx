import { Suspense } from "react";
import { CaseView } from "@/components/case/CaseView";

export const metadata = { title: "Repair case" };

export default function TenantCasePage({ params }: PageProps<"/tenant/cases/[id]">) {
  // params is runtime data, so it must be read inside <Suspense> (Cache Components).
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading case…</p>}>
      <Case params={params} />
    </Suspense>
  );
}

async function Case({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseView caseId={id} role="tenant" />;
}
