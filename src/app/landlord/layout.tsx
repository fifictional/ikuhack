import { LandlordNav } from "@/components/LandlordNav";
import { requireRole } from "@/lib/session";

/**
 * Guards the whole /landlord subtree in one place — see src/app/tenant/layout.tsx for why
 * `instant = false` matters (it turns the guard into a real server-side redirect). The sub-nav
 * sits here too, so every section gets it without repeating the markup.
 */
export const instant = false;

export default async function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  await requireRole("landlord");
  return (
    <div className="space-y-6">
      <LandlordNav />
      {children}
    </div>
  );
}
