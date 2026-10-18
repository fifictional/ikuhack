import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { T } from "@/components/i18n/I18n";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="flex flex-col-reverse items-start gap-8 px-2 py-10 sm:flex-row sm:items-center sm:px-6">
        <div className="flex-1 space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            <T k="home.title" />
          </h1>
          <p className="max-w-xl text-lg text-ink/80">
            <T k="home.intro" />
          </p>
          <Link href="/tenant/report" className="inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-dark">
            <T k="home.cta" />
          </Link>
        </div>
        <LogoMark size={120} className="shrink-0" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/tenant" className="group rounded-xl border border-border bg-surface p-6 hover:border-primary">
          <h2 className="text-lg font-bold group-hover:text-primary"><T k="home.tenantTitle" /></h2>
          <p className="mt-1 text-sm text-muted"><T k="home.tenantBody" /></p>
        </Link>
        <Link href="/landlord" className="group rounded-xl border border-border bg-surface p-6 hover:border-primary">
          <h2 className="text-lg font-bold group-hover:text-primary"><T k="home.landlordTitle" /></h2>
          <p className="mt-1 text-sm text-muted"><T k="home.landlordBody" /></p>
        </Link>
      </div>
    </div>
  );
}
