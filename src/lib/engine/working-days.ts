/**
 * UK (England & Wales) working-day arithmetic in Europe/London time.
 * Statutory deadlines like "10 working days" end at the end of the nth working
 * day after the trigger, excluding weekends and bank holidays.
 */

// Source: https://www.gov.uk/bank-holidays.json (england-and-wales). Extend before 2028.
const BANK_HOLIDAYS = new Set([
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-05", "2025-05-26", "2025-08-25", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
]);

const LONDON = "Europe/London";
const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit" });
const offsetFormat = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, timeZoneName: "shortOffset" });

const HOUR = 3_600_000;

/** Calendar date in London as YYYY-MM-DD. */
export function londonYmd(d: Date): string {
  return ymdFormat.format(d);
}

/** London's UTC offset in minutes at instant `d` (0 in GMT, 60 in BST). */
function londonOffsetMinutes(d: Date): number {
  const tz = offsetFormat.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** 23:59:59 London time on the given date, as a UTC instant. */
export function londonEndOfDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  return new Date(naive.getTime() - londonOffsetMinutes(naive) * 60_000);
}

function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function isWorkingDay(ymd: string): boolean {
  const day = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !BANK_HOLIDAYS.has(ymd);
}

/** End of the nth working day after `from`'s London date. */
export function addWorkingDays(from: Date, n: number): Date {
  let ymd = londonYmd(from);
  let counted = 0;
  while (counted < n) {
    ymd = nextYmd(ymd);
    if (isWorkingDay(ymd)) counted++;
  }
  return londonEndOfDay(ymd);
}

/** End of the London calendar day n days after `from`. */
export function addCalendarDays(from: Date, n: number): Date {
  let ymd = londonYmd(from);
  for (let i = 0; i < n; i++) ymd = nextYmd(ymd);
  return londonEndOfDay(ymd);
}

export function addHours(from: Date, h: number): Date {
  return new Date(from.getTime() + h * HOUR);
}
