import { VerifyForm } from "@/components/verify/VerifyForm";

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Verify a record</h1>
        <p className="text-sm text-muted">
          Drop in any photo or document from a Docket bundle. We hash it in your browser and check it against the
          fingerprint anchored on Solana — proving it hasn&apos;t been altered since it was logged.
        </p>
      </div>
      <VerifyForm />
    </div>
  );
}
