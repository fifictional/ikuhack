import { LandlordNav } from "@/components/LandlordNav";
import { LocaleScope } from "@/components/i18n/I18n";
import { requireRole } from "@/lib/session";

/**
 * Guards the whole /landlord subtree in one place — see src/app/tenant/layout.tsx for why
 * `instant = false` matters (it turns the guard into a real server-side redirect). The sub-nav
 * sits here too, so every section gets it without repeating the markup.
 */
export const instant = false;

export default async function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  await requireRole("landlord");
  // The landlord side stays in English (see docs/LANGUAGES.md).
  return (
    <LocaleScope locale="en">
      <div lang="en-GB" dir="ltr" className="space-y-6">
        <LandlordNav />
        {children}
      </div>
    </LocaleScope>
  );
}
