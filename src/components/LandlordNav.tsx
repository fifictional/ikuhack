"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The two-level nav inside /landlord. Client-side only because highlighting the active tab
 * needs the current URL, which a server component can't read. */
const LINKS = [
  { href: "/landlord", label: "Repairs" },
  { href: "/landlord/certificates", label: "Certificates" },
  { href: "/landlord/proof", label: "Proof" },
] as const;

export function LandlordNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Landlord sections" className="flex flex-wrap gap-x-1 gap-y-1 border-b border-border pb-2 text-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-primary px-3 py-1.5 font-medium text-white"
                : "rounded-md px-3 py-1.5 font-medium text-muted hover:bg-primary-tint hover:text-ink"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
