import { LocaleScope } from "@/components/i18n/I18n";
import { localeInfo } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { requireRole } from "@/lib/session";

/**
 * Guards the whole /tenant subtree in one place: the dashboard, /tenant/report and
 * /tenant/cases/[id] are all covered by this single check.
 *
 * `instant = false` makes the segment block on the server, so a landlord (or a signed-out
 * visitor) gets a real 307 back to /login before any of this section renders. Without it the
 * guard would run after streaming started and could only bounce the browser client-side.
 */
export const instant = false;

export default async function TenantLayout({ children }: LayoutProps<"/tenant">) {
  await requireRole("tenant");
  // Tenant screens render in the chosen language on the server, so there's no flash of English.
  const locale = await getLocale();
  return (
    <LocaleScope locale={locale}>
      <div lang={locale} dir={localeInfo(locale).dir}>{children}</div>
    </LocaleScope>
  );
}
