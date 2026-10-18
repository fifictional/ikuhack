/**
 * Website languages. Tenant screens are translated; landlord, demo and legal text stay English
 * (see docs/LANGUAGES.md). Every language here is also one the voice agent can speak.
 */
export const LOCALES = [
  { code: "en", name: "English", intl: "en-GB", dir: "ltr" },
  { code: "pl", name: "Polski", intl: "pl-PL", dir: "ltr" },
  { code: "ar", name: "العربية", intl: "ar-u-nu-latn", dir: "rtl" },
  { code: "ro", name: "Română", intl: "ro-RO", dir: "ltr" },
  { code: "es", name: "Español", intl: "es-ES", dir: "ltr" },
  { code: "ru", name: "Русский", intl: "ru-RU", dir: "ltr" },
  { code: "tr", name: "Türkçe", intl: "tr-TR", dir: "ltr" },
  { code: "hi", name: "हिन्दी", intl: "hi-IN", dir: "ltr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";
/** Readable by the browser (not httpOnly) so the client can switch without a round trip. */
export const LOCALE_COOKIE = "docket-lang";

export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.code === v);
export const localeInfo = (l: Locale) => LOCALES.find((x) => x.code === l)!;
