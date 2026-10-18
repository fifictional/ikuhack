import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { LocaleScope, T } from "@/components/i18n/I18n";
import { translator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getRole, type Role } from "@/lib/session";
import { signIn } from "./actions";

export const metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div className="space-y-2 text-center">
        <LogoMark size={44} className="mx-auto" />
        <h1 className="text-2xl font-semibold"><T k="login.title" /></h1>
        <p className="text-sm text-muted">
          <T k="login.intro" />
        </p>
      </div>
      {/* Reads the request (session cookie + error query), so it streams in behind a boundary. */}
      <Suspense fallback={<p className="text-sm text-muted"><T k="common.loading" /></p>}>
        <SignInCard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignInCard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const role = await getRole();
  // Already signed in? Skip the form.
  if (role) redirect(`/${role}`);

  const { error } = await searchParams;
  // Streams in after hydration: render in the cookie's language so server and client agree.
  const locale = await getLocale();
  const t = translator(locale);

  return (
    <LocaleScope locale={locale}>
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-danger bg-surface px-3 py-2 text-sm text-danger">
          <T k="login.error" />
        </p>
      )}
      <form action={signIn} className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium"><T k="login.iAmA" /></legend>
          <div className="grid grid-cols-2 gap-2">
            <RoleTab value="tenant" label={<T k="login.tenant" />} defaultChecked />
            <RoleTab value="landlord" label={<T k="login.landlord" />} />
          </div>
        </fieldset>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium"><T k="login.email" /></label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium"><T k="login.password" /></label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder={t("login.passwordPlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark"
        >
          <T k="login.submit" />
        </button>
      </form>
    </div>
    </LocaleScope>
  );
}

/**
 * A radio styled as a segmented tab. No JavaScript: the hidden radio is still focusable,
 * so `has-[:focus-visible]` keeps the keyboard focus ring on the visible label.
 */
function RoleTab({ value, label, defaultChecked }: { value: Role; label: React.ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-center text-sm font-medium text-ink hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
      <input type="radio" name="role" value={value} defaultChecked={defaultChecked} className="sr-only" />
      {label}
    </label>
  );
}
