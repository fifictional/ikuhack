import Link from "next/link";
import { getRole } from "@/lib/session";
import { signOut } from "@/app/login/actions";

const LABEL = { tenant: "Tenant", landlord: "Landlord" } as const;

/**
 * Link to the section you're signed in as. Renders nothing otherwise, so the header never
 * offers a door that the layout guard would immediately slam.
 */
export async function RoleNavLink() {
  const role = await getRole();
  if (!role) return null;

  return (
    <Link href={`/${role}`} className="font-medium text-ink/80 hover:text-primary">
      {LABEL[role]}
    </Link>
  );
}

/**
 * Sign in / sign out control. Reads the session cookie, so it must render inside a
 * <Suspense> boundary in the layout (a top-level session read would hold the whole page).
 */
export async function SessionNav() {
  const role = await getRole();

  if (!role) {
    return (
      <Link href="/login" className="font-medium text-ink/80 hover:text-primary">
        Sign in
      </Link>
    );
  }

  return (
    <form action={signOut}>
      <button type="submit" className="font-medium text-ink/80 hover:text-primary">
        Sign out
      </button>
    </form>
  );
}
