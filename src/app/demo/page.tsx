import { DemoPanel } from "@/components/demo/DemoPanel";

// Presenter-only page: reachable by URL, not linked from the site, and kept out of search results.
export const metadata = { title: "Demo controls", robots: { index: false, follow: false } };

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Demo controls</h1>
        <p className="text-sm text-muted">Move time, bring a new law into force, stream sensor data and anchor evidence.</p>
      </div>
      <DemoPanel />
    </div>
  );
}
