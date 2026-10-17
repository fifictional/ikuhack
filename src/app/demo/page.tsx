import { DemoPanel } from "@/components/demo/DemoPanel";

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Demo controls</h1>
        <p className="text-sm text-muted">Move time, bring a new law into force, stream sensor data, anchor evidence. For the pitch only.</p>
      </div>
      <DemoPanel />
    </div>
  );
}
