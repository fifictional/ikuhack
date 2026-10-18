import type { Obligation } from "@/lib/domain/types";
import { type Locale, localeInfo } from "./locales";
import { en, type MessageKey, type Messages } from "./messages/en";
import { ar } from "./messages/ar";
import { es } from "./messages/es";
import { hi } from "./messages/hi";
import { pl } from "./messages/pl";
import { ro } from "./messages/ro";
import { ru } from "./messages/ru";
import { tr } from "./messages/tr";

export * from "./locales";
export type { MessageKey } from "./messages/en";

const MESSAGES: Record<Locale, Messages> = { en, pl, ar, ro, es, ru, tr, hi };

export type Vars = Record<string, string | number>;

/** Look up a message, falling back to English, and fill `{placeholders}`. */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const s = MESSAGES[locale]?.[key] ?? en[key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

export type T = (key: MessageKey, vars?: Vars) => string;
export const translator = (locale: Locale): T => (key, vars) => translate(locale, key, vars);

/** Short date and time in the tenant's language, always in UK time (deadlines are UK deadlines). */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(localeInfo(locale).intl, {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Just the action, capitalised, for compact lists: "Fix it". */
export function dutyActionIn(locale: Locale, o: Obligation): string {
  const key = `duty.${o.id.split(":")[0]}` as MessageKey;
  const action = key in en ? translate(locale, key) : o.title;
  return action.charAt(0).toLocaleUpperCase(localeInfo(locale).intl) + action.slice(1);
}

/** Tenant's plain-language view of a duty, e.g. "Riverside Homes must fix it". */
export function plainDutyIn(locale: Locale, o: Obligation, landlordName: string): string {
  const key = `duty.${o.id.split(":")[0]}` as MessageKey;
  const action = key in en ? translate(locale, key) : o.title.toLowerCase();
  return o.party === "tenant"
    ? translate(locale, "duty.youNeed", { action })
    : translate(locale, "duty.landlordMust", { landlord: landlordName, action });
}

/** Badge for a duty's type (mirrors dutyType() in lib/ui/labels.ts). */
export function dutyTypeIn(locale: Locale, o: Obligation): { text: string; tone: "dark" | "light" } {
  if (!o.legalBasis.statutory) return { text: translate(locale, "dutyType.target"), tone: "light" };
  if (o.legalBasis.deadline === "law") {
    const awaab = o.legalBasis.citation.includes("Awaab");
    return { text: translate(locale, awaab ? "dutyType.lawAwaab" : "deadline.law"), tone: "dark" };
  }
  return { text: translate(locale, "dutyType.reasonable"), tone: "dark" };
}

/** Deadline wording; only fixed periods in law are called legal deadlines. */
export function deadlineLabelIn(locale: Locale, o: Obligation): string {
  if (!o.legalBasis.statutory) return translate(locale, "deadline.docket");
  return translate(locale, o.legalBasis.deadline === "law" ? "deadline.law" : "deadline.target");
}
