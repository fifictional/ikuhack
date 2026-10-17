import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="flex flex-col-reverse items-start gap-8 rounded-2xl bg-cream px-6 py-10 sm:flex-row sm:items-center sm:px-10">
        <div className="flex-1 space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Every rental repair, <span className="text-teal">on the clock</span> and on the record.
          </h1>
          <p className="max-w-xl text-lg text-ink/80">
            Report a problem in seconds, by voice in any language or with a photo. Docket works out who is responsible
            and the legal deadline, tracks both sides, and keeps evidence neither side can rewrite.
          </p>
          <Link href="/tenant/report" className="inline-block rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-teal-dark">
            Report a problem
          </Link>
        </div>
        <LogoMark size={120} className="shrink-0" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/tenant" className="group rounded-xl border border-border bg-surface p-6 hover:border-teal">
          <span className="mb-3 block h-1 w-10 rounded-full bg-terracotta" />
          <h2 className="text-lg font-bold group-hover:text-teal">I&apos;m a tenant</h2>
          <p className="mt-1 text-sm text-muted">Report a repair, see your landlord&apos;s deadline, and escalate if it&apos;s missed.</p>
        </Link>
        <Link href="/landlord" className="group rounded-xl border border-border bg-surface p-6 hover:border-teal">
          <span className="mb-3 block h-1 w-10 rounded-full bg-teal" />
          <h2 className="text-lg font-bold group-hover:text-teal">I&apos;m a landlord</h2>
          <p className="mt-1 text-sm text-muted">Live statutory clocks across your homes, with an audit trail that proves compliance.</p>
        </Link>
      </div>
    </div>
  );
}
