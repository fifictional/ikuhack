"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { playLogoWalkthrough } from "@/components/brand/LogoWalkthrough";

/**
 * A next/link that, on a plain left-click, runs the walk-through animation instead of navigating
 * immediately. Modified clicks (new tab, middle click, cmd/ctrl+click) and keyboard/AT activation
 * fall through to Link's normal behaviour so the page stays usable.
 */
export function WalkThroughLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        playLogoWalkthrough(href);
      }}
    >
      {children}
    </Link>
  );
}
