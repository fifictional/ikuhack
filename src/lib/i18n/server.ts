import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, isLocale } from "./locales";

/**
 * The visitor's chosen website language, from the cookie the language switcher sets.
 * Reads the request, so call it inside a <Suspense> boundary or a dynamic segment.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
