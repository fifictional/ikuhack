import type { CaseEvent, CaseState, EscalationRoute } from "@/lib/domain/types";

/**
 * Generates escalation documents for the TENANT to send. Docket provides legal
 * information and document generation; it does not conduct litigation
 * (a reserved activity under the Legal Services Act 2007).
 */

export interface LetterContext {
  state: CaseState;
  events: CaseEvent[];
  tenantName: string;
  landlordName: string;
  address: string;
  title: string;
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

function chronology(ctx: LetterContext): string {
  return ctx.events
    .filter((e) => !["FACT_ASSERTED", "FACT_RETRACTED"].includes(e.type))
    .map((e) => `- ${date(e.at)}: ${e.type.replaceAll("_", " ").toLowerCase()}${"description" in e ? ` — ${e.description}` : ""}`)
    .join("\n");
}

function breaches(ctx: LetterContext): string {
  return ctx.state.obligations
    .filter((o) => o.party === "landlord" && o.status === "breached")
    .map((o) => `- ${o.title} (due ${date(o.dueAt)}; ${o.legalBasis.citation})`)
    .join("\n");
}

/** Letter of claim — structure follows the Pre-Action Protocol for Housing Conditions Claims (England), Annex A. */
function preActionLetter(ctx: LetterContext): string {
  return `Dear ${ctx.landlordName},

LETTER OF CLAIM — ${ctx.address}

I am the tenant of the above property. I write under the Pre-Action Protocol for Housing Conditions Claims (England).

1. Defects
${ctx.title}. ${String(ctx.state.facts["issue.summary"]?.value ?? "")}

2. Notice
You were first notified on ${date(ctx.state.noticeAt)} via Docket. A timestamped, tamper-evident record of every report and response is attached.

3. History
${chronology(ctx)}

4. Duties not met
${breaches(ctx) || "- (none recorded)"}

5. Effect on the household
[TENANT TO COMPLETE — health effects, damage to belongings, rooms that cannot be used]

6. Disclosure
Please disclose all documents relating to the condition of the property and any repairs, including inspection reports and contractor records.

7. Expert
I propose a single joint expert to inspect the property. [TENANT TO COMPLETE — name, or ask Docket for suggestions]

Please acknowledge this letter and respond in full within 20 working days.

Yours faithfully,
${ctx.tenantName}`;
}

function formalComplaint(ctx: LetterContext): string {
  return `Dear ${ctx.landlordName},

FORMAL COMPLAINT — ${ctx.address}

I am making a formal complaint under your complaints policy about the handling of: ${ctx.title}.

Missed duties:
${breaches(ctx)}

History:
${chronology(ctx)}

Please respond in line with the Housing Ombudsman Complaint Handling Code. If this is not resolved, I will refer it to the Housing Ombudsman.

${ctx.tenantName}`;
}

function councilReferral(ctx: LetterContext): string {
  return `To the Private Sector Housing / Environmental Health team,

I request an inspection of ${ctx.address} under Part 1 of the Housing Act 2004 (HHSRS).

Problem: ${ctx.title}. ${String(ctx.state.facts["issue.summary"]?.value ?? "")}
Landlord: ${ctx.landlordName}, notified ${date(ctx.state.noticeAt)}.

Missed duties:
${breaches(ctx)}

History:
${chronology(ctx)}

${ctx.tenantName}`;
}

function ombudsmanReferral(ctx: LetterContext): string {
  return `Housing Ombudsman referral — ${ctx.address}

Landlord: ${ctx.landlordName}
Issue: ${ctx.title}
First reported: ${date(ctx.state.noticeAt)}

Missed duties:
${breaches(ctx)}

History:
${chronology(ctx)}

[TENANT TO CONFIRM the landlord's complaints process has been completed, or 8 weeks have passed since the final response.]`;
}

export function generateLetter(route: EscalationRoute, ctx: LetterContext): string {
  switch (route) {
    case "pre_action_letter":
      return preActionLetter(ctx);
    case "formal_complaint":
      return formalComplaint(ctx);
    case "council_environmental_health":
      return councilReferral(ctx);
    case "housing_ombudsman":
      return ombudsmanReferral(ctx);
  }
}
// Tone/translation is applied by src/lib/ai/letter-polish.ts; the facts, dates and citations above stay verbatim.
