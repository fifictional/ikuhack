"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The footer's "Check now" button: triggers the check route, then refreshes the footer read. */
export function CheckNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/law/check", { method: "POST" });
          router.refresh();
        } catch {
          /* leave the button usable; the footer will still show the old result */
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-primary disabled:opacity-50"
    >
      {busy ? "Checking…" : "Check now"}
    </button>
  );
}
