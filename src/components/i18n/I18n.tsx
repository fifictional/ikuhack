"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
  type MessageKey,
  type T as Translator,
  type Vars,
  isLocale,
  localeInfo,
  translate,
} from "@/lib/i18n";

/**
 * Client side of the website languages.
 * - <I18nProvider> (root layout) follows the language cookie, so static pages switch after load.
 * - <LocaleScope locale> pins a language from the server: tenant pages pass the cookie's value (no flash),
 *   landlord and demo pages pin English.
 * - useT() / <T k="…"/> translate; <LanguageSwitcher/> sets the cookie and re-renders server components.
 */

const EVENT = "docket-locale";
const Ctx = createContext<Locale | null>(null);

function readCookie(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Landlord and demo areas are English-only by design. */
const englishOnly = (path: string) => path.startsWith("/landlord") || path.startsWith("/demo");

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const cookieLocale = useSyncExternalStore(subscribe, readCookie, () => DEFAULT_LOCALE);
  const pathname = usePathname();
  const locale = englishOnly(pathname) ? DEFAULT_LOCALE : cookieLocale;

  // Keep <html lang/dir> in step so screen readers and right-to-left layout follow the language.
  useEffect(() => {
    const info = localeInfo(locale);
    document.documentElement.lang = locale === "en" ? "en-GB" : locale;
    document.documentElement.dir = info.dir;
  }, [locale]);

  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function LocaleScope({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  return useContext(Ctx) ?? DEFAULT_LOCALE;
}

export function useT(): Translator {
  const locale = useLocale();
  return (key, vars) => translate(locale, key, vars);
}

/** Inline translated text, usable from server components. */
export function T({ k, vars }: { k: MessageKey; vars?: Vars }) {
  return <>{useT()(k, vars)}</>;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  if (englishOnly(pathname)) return null;

  function choose(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
    router.refresh(); // server-rendered tenant pages read the cookie
  }

  // A native <select> styled as a button: keyboard and screen-reader friendly, and opens the phone's own picker.
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-surface px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-tint focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <GlobeIcon />
      <span aria-hidden>{localeInfo(locale).name}</span>
      <span aria-hidden className="text-xs">▾</span>
      <select
        value={locale}
        onChange={(e) => choose(e.target.value as Locale)}
        aria-label={t("nav.language")}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Outline globe in the current text colour, so it follows the greyscale theme (emoji render in colour). */
function GlobeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
