import Link from "next/link";
import { LocaleScope, T } from "@/components/i18n/I18n";
import { getLocale } from "@/lib/i18n/server";
import { getRole } from "@/lib/session";
import { signOut } from "@/app/login/actions";

const LABEL = { tenant: "nav.tenant", landlord: "nav.landlord" } as const;

/**
 * Link to the section you're signed in as. Renders nothing otherwise, so the header never
 * offers a door that the layout guard would immediately slam.
 */
export async function RoleNavLink() {
  const role = await getRole();
  if (!role) return null;

  return (
    <LocaleScope locale={role === "landlord" ? "en" : await getLocale()}>
      <Link href={`/${role}`} className="font-medium text-ink/80 hover:text-primary">
        <T k={LABEL[role]} />
      </Link>
    </LocaleScope>
  );
}

/**
 * Sign in / sign out control. Reads the session cookie, so it must render inside a
 * <Suspense> boundary in the layout (a top-level session read would hold the whole page).
 */
export async function SessionNav() {
  const role = await getRole();
  // These stream in after hydration, so they must render in the same language on server and client.
  // Landlords stay in English.
  const locale = role === "landlord" ? "en" : await getLocale();

  if (!role) {
    return (
      <LocaleScope locale={locale}>
        <Link href="/login" className="font-medium text-ink/80 hover:text-primary">
          <T k="nav.signIn" />
        </Link>
      </LocaleScope>
    );
  }

  return (
    <LocaleScope locale={locale}>
      <form action={signOut}>
        <button type="submit" className="font-medium text-ink/80 hover:text-primary">
          <T k="nav.signOut" />
        </button>
      </form>
    </LocaleScope>
  );
}
