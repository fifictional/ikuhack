import { db } from "@/lib/db/client";
import { LEGAL_SOURCES } from "@/lib/engine/sources";
import { BANK_HOLIDAYS } from "@/lib/engine/working-days";

/**
 * Law freshness check. For each registered source, fetch its official page and compare its
 * last-modified date against the date a human last verified it (verified.on in sources.ts).
 * The flag is always "changed since we checked → human review", never "wrong".
 *
 * legislation.gov.uk sources are checked via their DC.Date.Modified meta tag (on the LATEST
 * version, not a point-in-time "/made" copy); bank holidays via the gov.uk JSON feed; the rest
 * (gov.uk guidance, justice.gov.uk protocol, case law) have no machine-readable check and stay manual.
 */

const UA = { "User-Agent": "Docket/0.1 (law freshness check)" };

/** Sources with no machine-readable check: they stay "manual" with the human's last-verified date. */
const MANUAL_NOTE: Record<string, string> = {
  awaab_phase2_guidance: "gov.uk guidance — no structured API, manual review",
  pap_housing: "justice.gov.uk protocol — manual review",
  warren_v_keen: "case-law summary — manual review",
};

export type CheckResult = {
  sourceId: string;
  status: "current" | "amended" | "manual";
  modifiedOn: string | null;
  note: string | null;
};

const isLegislation = (url: string) => new URL(url).hostname === "www.legislation.gov.uk";
/** The latest (revised) version, not a point-in-time "/made" copy that never changes. */
const latestUrl = (url: string) => url.replace(/\/made$/, "");
const MODIFIED_RE = /DC\.Date\.Modified"\s+content="([^"]+)"/;

async function checkLegislation(id: string, url: string): Promise<CheckResult> {
  const res = await fetch(latestUrl(url), { headers: UA, cache: "no-store" });
  if (!res.ok) {
    return { sourceId: id, status: "manual", modifiedOn: null, note: `legislation.gov.uk returned HTTP ${res.status}` };
  }
  const modifiedOn = (await res.text()).match(MODIFIED_RE)?.[1] ?? null;
  if (!modifiedOn) {
    return { sourceId: id, status: "manual", modifiedOn: null, note: "modification date not found on page" };
  }
  const verifiedOn = LEGAL_SOURCES[id as keyof typeof LEGAL_SOURCES].verified.on;
  const amended = modifiedOn > verifiedOn; // ISO YYYY-MM-DD compares correctly as strings.
  return {
    sourceId: id,
    status: amended ? "amended" : "current",
    modifiedOn,
    note: amended ? `modified ${modifiedOn}, after last check ${verifiedOn}` : null,
  };
}

async function checkBankHolidays(): Promise<CheckResult> {
  const res = await fetch("https://www.gov.uk/bank-holidays.json", { headers: UA, cache: "no-store" });
  if (!res.ok) {
    return { sourceId: "bank_holidays", status: "manual", modifiedOn: null, note: `gov.uk returned HTTP ${res.status}` };
  }
  const data = (await res.json()) as { "england-and-wales"?: { events?: { date: string }[] } };
  const feed = new Set((data["england-and-wales"]?.events ?? []).map((e) => e.date).filter((d) => /^202[5-7]-/.test(d)));
  const ours = new Set([...BANK_HOLIDAYS].filter((d) => /^202[5-7]-/.test(d)));
  const same = feed.size === ours.size && [...feed].every((d) => ours.has(d));
  return {
    sourceId: "bank_holidays",
    status: same ? "current" : "amended",
    modifiedOn: null,
    note: same ? null : "bank holiday feed differs from working-days.ts",
  };
}

/** Run every check; manual sources are recorded as such rather than skipped. */
export async function runLawCheck(): Promise<CheckResult[]> {
  const manual: CheckResult[] = [];
  const jobs: Promise<CheckResult>[] = [];
  for (const [id, src] of Object.entries(LEGAL_SOURCES)) {
    if (id === "bank_holidays") jobs.push(checkBankHolidays());
    else if (MANUAL_NOTE[id]) manual.push({ sourceId: id, status: "manual", modifiedOn: null, note: MANUAL_NOTE[id] });
    else if (isLegislation(src.url)) jobs.push(checkLegislation(id, src.url));
    else manual.push({ sourceId: id, status: "manual", modifiedOn: null, note: "not on a machine-readable source" });
  }
  return [...manual, ...(await Promise.all(jobs))];
}

/** Persist one run's results and return the run timestamp. */
export async function persistLawCheck(results: CheckResult[]): Promise<Date> {
  const checkedAt = new Date();
  const sql = db();
  for (const r of results) {
    await sql`
      INSERT INTO law_source_checks (source_id, checked_at, status, modified_on, note)
      VALUES (${r.sourceId}, ${checkedAt}, ${r.status}, ${r.modifiedOn}, ${r.note})
    `;
  }
  return checkedAt;
}
