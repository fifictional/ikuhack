import { T } from "@/components/i18n/I18n";
import { ReportFlow } from "@/components/report/ReportFlow";

export const metadata = { title: "Report a problem" };

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold"><T k="report.title" /></h1>
        <p className="text-sm text-muted"><T k="report.intro" /></p>
      </div>
      <ReportFlow />
    </div>
  );
}
