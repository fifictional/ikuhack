import type { LegalBasis } from "@/lib/domain/types";

/**
 * Recurring statutory compliance duties: gas safety (annual) and EICR
 * (5-yearly), each with a 28-day deadline to give the tenant a copy.
 *
 * Pure and deterministic, like the case engine: same properties + records +
 * `now` → same duties. The deadlines come from the sources registered in
 * engine/sources.ts; this module never invents a number.
 */

export type ComplianceKind = "gas_safety" | "eicr";

export interface ComplianceProperty {
  id: string;
  address: string;
  postcode: string;
  landlordType: "social" | "private";
}

export interface ComplianceRecord {
  id: string;
  propertyId: string;
  kind: ComplianceKind;
  performedAt: string;
  copySentAt: string | null;
}

export interface ComplianceDuty {
  id: string;
  propertyId: string;
  propertyAddress: string;
  kind: ComplianceKind;
  title: string;
  detail: string;
  dueAt: string;
  status: "open" | "breached" | "met";
  legalBasis: LegalBasis;
}

interface Rule {
  label: string;
  /** Months between inspections. */
  intervalMonths: number;
  /** Days allowed to give the tenant a copy of the record. */
  copyDays: number;
  copyTitle: string;
  sourceId: string;
  citation: string;
  url: string;
  detail: string;
}

export const COMPLIANCE_RULES: Record<ComplianceKind, Rule> = {
  gas_safety: {
    label: "Annual gas safety check",
    intervalMonths: 12,
    copyDays: 28,
    copyTitle: "Give the tenant the gas safety record",
    sourceId: "gas_safety_regs_1998",
    citation: "Gas Safety (Installation and Use) Regulations 1998, reg 36",
    url: "https://www.legislation.gov.uk/uksi/1998/2451/contents/made",
    detail: "A Gas Safe registered engineer must check every gas appliance and flue at least every 12 months. The record must be kept for 2 years and a copy given to the tenant within 28 days of the check.",
  },
  eicr: {
    label: "Electrical safety report (EICR)",
    intervalMonths: 60,
    copyDays: 28,
    copyTitle: "Give the tenant the EICR",
    sourceId: "eicr_regs_2020",
    citation: "Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020, reg 3",
    url: "https://www.legislation.gov.uk/uksi/2020/312/contents/made",
    detail: "The electrical installation must be inspected and tested by a qualified person at least every 5 years, and the tenant must get a copy of the report within 28 days.",
  },
};

/** Add whole months in UTC, clamping to the last day when the target month is shorter. */
function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d;
}

function addDays(iso: string, days: number): Date {
  return new Date(new Date(iso).getTime() + days * 86_400_000);
}

const basis = (rule: Rule): LegalBasis => ({
  citation: rule.citation,
  statutory: true,
  deadline: "law",
  url: rule.url,
  sourceId: rule.sourceId,
});

export function complianceDuties(
  properties: ComplianceProperty[],
  records: ComplianceRecord[],
  now: Date,
): ComplianceDuty[] {
  const duties: ComplianceDuty[] = [];

  for (const p of properties) {
    const propertyAddress = `${p.address}, ${p.postcode}`;
    for (const kind of Object.keys(COMPLIANCE_RULES) as ComplianceKind[]) {
      const rule = COMPLIANCE_RULES[kind];
      const latest = records
        .filter((r) => r.propertyId === p.id && r.kind === kind)
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];

      const base = { propertyId: p.id, propertyAddress, kind };

      if (!latest) {
        duties.push({
          ...base,
          id: `${p.id}:${kind}:missing`,
          title: `No ${rule.label.toLowerCase()} on file`,
          detail: rule.detail,
          dueAt: now.toISOString(),
          status: "breached",
          legalBasis: basis(rule),
        });
        continue;
      }

      const checkDue = addMonths(latest.performedAt, rule.intervalMonths);
      duties.push({
        ...base,
        id: `${p.id}:${kind}:check`,
        title: rule.label,
        detail: rule.detail,
        dueAt: checkDue.toISOString(),
        status: now.getTime() > checkDue.getTime() ? "breached" : "open",
        legalBasis: basis(rule),
      });

      const copyDue = addDays(latest.performedAt, rule.copyDays);
      duties.push({
        ...base,
        id: `${p.id}:${kind}:copy`,
        title: rule.copyTitle,
        detail: `A copy of the record must be given to the tenant within ${rule.copyDays} days of the check.`,
        dueAt: copyDue.toISOString(),
        status: latest.copySentAt ? "met" : now.getTime() > copyDue.getTime() ? "breached" : "open",
        legalBasis: basis(rule),
      });
    }
  }

  // Breaches first, then nearest deadline.
  return duties.sort(
    (a, b) => Number(b.status === "breached") - Number(a.status === "breached") || a.dueAt.localeCompare(b.dueAt),
  );
}
