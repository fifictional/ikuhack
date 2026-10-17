import { requireRole } from "@/lib/session";

/**
 * Guards the whole /landlord subtree in one place — see src/app/tenant/layout.tsx for why
 * `instant = false` matters (it turns the guard into a real server-side redirect).
 */
export const instant = false;

export default async function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  await requireRole("landlord");
  return children;
}
