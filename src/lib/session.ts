import { cookies } from "next/headers";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Demo sign-in. There is no password and no user record: the cookie only says which seeded
 * persona you are, and the ids still come from src/lib/demo.ts. Nothing is stored server-side.
 * TODO(stretch): replace with a real magic-link session before any real users.
 */
export type Role = "tenant" | "landlord";

const COOKIE = "docket-role";
/** 8 hours — a hackathon demo day, after which the persona expires and you land back on /login. */
const MAX_AGE = 60 * 60 * 8;

/**
 * The persona in the cookie, or null. "use cache: private" lets this read cookies() inside a
 * cached scope; the result is kept per-browser, never in a server cache. Must be called inside
 * a <Suspense> boundary (Cache Components refuses to prerender a route that reads the request).
 */
export async function getRole(): Promise<Role | null> {
  "use cache: private";
  cacheLife("minutes");
  const value = (await cookies()).get(COOKIE)?.value;
  return value === "tenant" || value === "landlord" ? value : null;
}

/** Use inside <Suspense>: sends anyone who isn't this persona to the sign-in page. */
export async function requireRole(role: Role): Promise<void> {
  if ((await getRole()) !== role) redirect("/login");
}

/** Server Action or Route Handler only — Next forbids setting cookies while rendering. */
export async function setRole(role: Role): Promise<void> {
  (await cookies()).set(COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

/** Server Action or Route Handler only. */
export async function clearRole(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
