import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-8">
        <h1 className="text-4xl font-semibold tracking-tight">Every rental repair, on the clock and on the record.</h1>
        <p className="max-w-2xl text-lg text-muted">
          Report a problem in seconds, by voice in any language or with a photo. Docket works out who is responsible and
          the legal deadline, tracks both sides, and keeps evidence neither side can rewrite.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/tenant" className="rounded-xl border border-border bg-surface p-6 hover:border-accent">
          <h2 className="text-lg font-semibold">I&apos;m a tenant</h2>
          <p className="mt-1 text-sm text-muted">Report a repair, see your landlord&apos;s deadline, and escalate if it&apos;s missed.</p>
        </Link>
        <Link href="/landlord" className="rounded-xl border border-border bg-surface p-6 hover:border-accent">
          <h2 className="text-lg font-semibold">I&apos;m a landlord</h2>
          <p className="mt-1 text-sm text-muted">Live statutory clocks across your homes, with an audit trail that proves compliance.</p>
        </Link>
      </div>
    </div>
  );
}
