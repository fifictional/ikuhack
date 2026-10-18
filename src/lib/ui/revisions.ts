import { fmtDayLong } from "./labels";

/** The shape returned by getCase(): case_revisions rows (only these three columns). */
export interface RevisionRow {
  at: Date;
  kind: string;
  summary: string;
}

export type DutyType = "law" | "duty" | "target";

/** Turn the engine's obligation titles into the tenant's plain words. */
const FRIENDLY_DUTY: Record<string, string> = {
  "Investigate and make safe (emergency hazard)": "make it safe",
  "Repair (structure, exterior or installations)": "fix it",
  "Make the home fit for human habitation": "make it fit to live in",
  "Acknowledge the report": "confirm they've received your report",
  "Repair or replace the faulty alarm": "fix the alarm",
  "Repair landlord-supplied appliance": "repair the appliance",
  "Investigate the hazard": "check the problem",
  "Send the tenant a written summary of the investigation": "send you a written summary",
  "Begin safety works": "start the repair work",
  "Attend the booked appointment": "turn up to the appointment",
  "Respond to the letter of claim": "reply to your letter of claim",
  "Put right damage caused by the household": "put right the damage",
};

const friendlyDuty = (title: string) => FRIENDLY_DUTY[title] ?? title.toLowerCase();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The revision rows don't carry the obligation, so learn each duty's type from
 * its "new deadline" entry. Used to say "Legal deadline" only when true.
 */
export function buildDutyTypes(revisions: RevisionRow[]): Map<string, DutyType> {
  const map = new Map<string, DutyType>();
  for (const r of revisions) {
    const m = /^New (legal deadline|legal duty|target) for \w+: "(.*)" by .+\.$/.exec(r.summary);
    if (m) map.set(m[2], m[1] === "legal deadline" ? "law" : m[1] === "legal duty" ? "duty" : "target");
  }
  return map;
}

export interface DescribedRevision {
  title: string;
  description: string;
  tone: "danger" | "normal";
}

/** A short bold title + one-line grey description for each change. */
export function describeRevision(r: RevisionRow, dutyTypes?: Map<string, DutyType>): DescribedRevision {
  const s = r.summary;

  switch (r.kind) {
    case "obligation_breached": {
      const m = /^\w+ missed "(.*)" \(due (.+)\)\.$/.exec(s);
      if (m) {
        return {
          title: `Missed: ${friendlyDuty(m[1])}`,
          description: `${dutyTypes?.get(m[1]) === "law" ? "Legal deadline" : "Deadline"} was ${m[2]}`,
          tone: "danger",
        };
      }
      break;
    }
    case "obligation_added": {
      const m = /^New (legal deadline|legal duty|target) for \w+: "(.*)" by (.+)\.$/.exec(s);
      if (m) {
        const [, kind, title, by] = m;
        const emergency = /emergency/i.test(title);
        return {
          title: emergency
            ? "Emergency deadline set"
            : kind === "legal deadline"
              ? "Legal deadline set"
              : kind === "legal duty"
                ? "Legal duty set"
                : "Docket target set",
          description: emergency ? `Make safe by ${by} (Awaab's Law, 24 hours)` : `${cap(friendlyDuty(title))} by ${by}`,
          tone: "normal",
        };
      }
      break;
    }
    case "obligation_met": {
      const m = /^"(.*)" met( late)?\.$/.exec(s);
      if (m) return { title: m[2] ? "Done late" : "Done", description: cap(friendlyDuty(m[1])), tone: "normal" };
      break;
    }
    case "obligation_reopened": {
      const m = /^Reopened "(.*)":/.exec(s);
      if (m) return { title: "Reopened", description: cap(friendlyDuty(m[1])), tone: "normal" };
      break;
    }
    case "obligation_abandoned": {
      const m = /^Dropped "(.*)":/.exec(s);
      if (m) return { title: "Dropped", description: cap(friendlyDuty(m[1])), tone: "normal" };
      break;
    }
    case "deadline_changed":
      return { title: "Deadline changed", description: s, tone: "normal" };
    case "fact_revised":
      return { title: "Docket changed its view", description: s, tone: "normal" };
    case "conflict_detected":
      return { title: "Sources disagree", description: s, tone: "normal" };
  }

  return { title: s, description: "", tone: "normal" };
}

/** Group newest-first revisions under a full day heading ("Sunday 25 October"). */
export function groupByDay(revisions: RevisionRow[]): { day: string; items: RevisionRow[] }[] {
  const groups: { day: string; items: RevisionRow[] }[] = [];
  for (const r of revisions) {
    const day = fmtDayLong(r.at.toISOString());
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(r);
    else groups.push({ day, items: [r] });
  }
  return groups;
}
