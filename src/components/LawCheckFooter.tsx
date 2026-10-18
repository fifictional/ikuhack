import { connection } from "next/server";
import { db } from "@/lib/db/client";
import { LEGAL_SOURCES } from "@/lib/engine/sources";
import { fmtDateTime } from "@/lib/ui/labels";
import { CheckNowButton } from "@/components/CheckNowButton";

type CheckRow = { source_id: string; checked_at: Date; status: "current" | "amended" | "manual" };

/**
 * The site-wide footer line: when the legal sources were last checked, and how many are
 * current / amended / manual. Reads the DB, so it sits behind a <Suspense> boundary and
 * awaits connection() first (Cache Components rule).
 */
export async function LawCheckFooter() {
  await connection();

  let rows: CheckRow[] = [];
  try {
    rows = await db()<CheckRow[]>`
      SELECT DISTINCT ON (source_id) source_id, checked_at, status
      FROM law_source_checks
      ORDER BY source_id, checked_at DESC
    `;
  } catch {
    return (
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted">
        <p>Legal sources: couldn&apos;t check just now.</p>
        <CheckNowButton />
      </div>
    );
  }

  const total = Object.keys(LEGAL_SOURCES).length;
  const count = (s: CheckRow["status"]) => rows.filter((r) => r.status === s).length;
  const amended = count("amended");
  const lastChecked = rows.length ? new Date(Math.max(...rows.map((r) => new Date(r.checked_at).getTime()))) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted">
      <p>
        {lastChecked ? (
          <>
            Legal sources last checked <span className="font-medium text-foreground">{fmtDateTime(lastChecked.toISOString())}</span>
            {/* Counts from tablet width up; on phones the fixed footer stays one line. Changes always show. */}
            <span className="hidden sm:inline">
              {" · "}
              {count("current")} up to date
            </span>
            {amended > 0 && (
              <>
                {" · "}
                <span className="font-medium text-warn">{amended} changed since last review</span>
              </>
            )}
            <span className="hidden sm:inline">
              {" · "}
              {count("manual")} reviewed by hand ({total} sources)
            </span>
          </>
        ) : (
          <>Legal sources haven&apos;t been checked yet.</>
        )}
      </p>
      <CheckNowButton />
    </div>
  );
}
