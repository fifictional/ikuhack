import { ReportFlow } from "@/components/report/ReportFlow";

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">What&apos;s wrong?</h1>
        <p className="text-sm text-muted">Talk to us in any language, or type and add photos. We&apos;ll work out the rest.</p>
      </div>
      <ReportFlow />
    </div>
  );
}
