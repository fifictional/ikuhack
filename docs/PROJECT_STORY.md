# Docket — project story

> Draft for the Devpost submission. IKU Hack 2026, Wise "Max Ease" track.

## What inspired us

In December 2020, Awaab Ishak died at the age of two. He had spent his whole life in a
one-bedroom social flat in Rochdale with mould his family reported repeatedly and nobody
fixed. The inquest found he died from prolonged exposure to mould.

The law changed in response. Section 42 of the Social Housing (Regulation) Act 2023 inserted
section 10A into the Landlord and Tenant Act 1985 — "Awaab's Law" — which puts time limits on
how long a social landlord may take to investigate and fix serious hazards. Phase 1 (damp and
mould, plus all emergencies) is in force. Phase 2 arrives on 30 November 2026.

So the legal machine exists. What doesn't exist is anything that makes it work in practice.
Ask a tenant what their landlord's deadline is and they won't know. Ask a landlord which of
their homes is nearest a breach and they'll open a spreadsheet. The facts that decide whether a
legal duty was met are scattered across a phone call, a photo in someone's camera roll, and a
paper certificate in a filing cabinet — so nothing can be proved by either side afterwards.

That gap is the product. Docket is a two-sided record of one repair, with the legal clock
visible to both people at once. Free for tenants; paid for by landlords, because "provable
compliance" is worth real money to a housing association that currently cannot prove anything
without a filing cabinet.

## What it does

A tenant reports a problem in seconds — by voice, in any language, or by photo and text. Gemini
reads the report and extracts facts. A deterministic rules engine works out which legal duty
applies and when it is due. Both parties then see the same clock: the landlord's deadlines
(acknowledge, give access, investigate, fix) and the tenant's own duties (respond to an access
request, don't refuse reasonable works).

The workflow is an event log. If a deadline passes, Docket drafts a pre-action protocol letter
of claim and a PDF bundle of the evidence. Every piece of evidence and every case-log head is
fingerprinted and anchored on Solana, so the record cannot be quietly edited later — by either
party. `/verify` lets anyone check a file against the chain.

## How we built it

Four layers, deliberately separated by how much we trust them.

**1. An event-sourced case.** A case is an append-only log of facts and actions in
`case_events`. Nothing is stored as "current state" — all state is derived by replaying the
log, and every write goes through one function (`appendEvent`) that re-projects, diffs, and
stores the result in `case_revisions`. Each event is hash-chained to the one before it, so
rewriting history means recomputing every subsequent hash:

$$h_1 = H(\texttt{""} \mathbin\| \mathrm{canonicalJSON}(e_1)), \qquad h_i = H(h_{i-1} \mathbin\| \mathrm{canonicalJSON}(e_i))$$

where $H$ is SHA-256.

**2. A pure, deterministic engine.** `project(events, {now, law, landlordType})` takes the log
and returns the case state. No I/O, no model calls, no clock reads — "now" is passed in, which
is what makes the demo's time travel possible and the whole thing unit-testable. Inside it,
`beliefs.ts` resolves facts from sources of differing reliability (an official record at 0.95, a
tenant report at 0.6); close disagreements become surfaced **conflicts** rather than averages,
and severity conflicts resolve safety-first. `rules.ts` turns facts plus law into obligations,
each carrying the facts it rests on, so `diff.ts` can explain *why* a conclusion appeared or
disappeared.

**3. A careful AI boundary.** Gemini only ever *extracts facts*, and each extracted fact is
recorded as an assertion with a source (`ai_text`, `ai_vision`) and that source's reliability.
The model never decides a duty or a date. Deadlines come from `law.ts`, where every number
traces to a verified official source in `sources.ts` (legislation.gov.uk, gov.uk, and the
Justice pre-action protocol). Prompts are only changed against an eval harness — 14 real
reports across five languages, currently 14/14.

**4. Integrations that make it feel like a product.** ElevenLabs runs the voice intake agent
(and Scribe for voice notes), with client-side tools so voice works on localhost with no tunnel.
Tiger Data holds the time-series side: hypertables for events and revisions, and a continuous
aggregate over simulated damp-sensor readings. Solana devnet receives a Merkle root over all
new evidence hashes and case-log heads as a memo, with pairs hashed in sorted order so a proof
is just a list of sibling hashes:

$$\mathrm{pair}(a,b) = H\big(\min(a,b) \mathbin\| \max(a,b)\big)$$

## Challenges we ran into

**Being legally honest was harder than being clever.** Our first version called every deadline a
"legal deadline". It wasn't true. Awaab's Law sets fixed periods, and the pre-action protocol
sets 20 working days, but section 11 of the 1985 Act imposes a duty to repair *within a
reasonable time* and names no number at all. We rebuilt the vocabulary: only fixed periods in
law are "legal deadlines"; Docket's own estimates are "targets", labelled differently on screen.
The landlord's "missed deadlines" counter counts only the real ones. This matters more than it
sounds — a product that overstates the law is worse than no product, and we would rather be
correct in front of a judge than impressive.

**The law moves, so the engine had to.** Awaab's Law Phase 2 is laid but not yet in force, and
its real start date is 30 November 2026. We model commencement dates as data, so `/demo` can
advance the clock and a heating case visibly gains statutory deadlines. It also means we can
show a judge the caveats honestly: Phase 2 is subject to Parliamentary approval, and we say so.

**Models are bad at numbers, so we don't let them near numbers.** Free-tier Gemini is limited to
five requests per minute per model, which shaped the architecture as much as it shaped the
budget: `generateStructured` retries and then falls back through a chain of models, and the
intake eval is paced so a full run takes about three minutes. The harder problem was trust. A
model that reads "the boiler is broken" and returns a deadline is a model that will eventually
invent one. So extraction and judgement are separate layers, and only the deterministic one is
allowed to have an opinion.

**Explaining a changed mind.** Our favourite demo moment came from a bug fix. When a contractor
records a leak into the subfloor, the appliance duty is dropped and the section 11 repair duty
appears. That's correct — and completely confusing unless you say why. Every conclusion now
carries the facts it rests on, and the revision feed reads like a person explaining themselves:
"the appliance is no longer the landlord's to fix, because *whether the landlord supplied the
appliance* changed to no."

**Working days are not arithmetic.** "10 working days" excludes weekends, Christmas Day, Good
Friday and bank holidays, and the deadline ends at the end of a day in Europe/London — which is
not the same length on the two days a year the clocks change. We built it on the GOV.UK bank
holiday feed and asserted the 2025–2027 dates match exactly.

**Rediscovering the edge of a framework we'd just adopted.** Next.js 16's Cache Components
refuses to prerender a route that reads the request, and a session read is a request read. Our
sign-in guard therefore had to either stream and bounce the browser after the fact, or opt the
segment out of instant navigation so it blocks on the server and returns a real redirect. We
took the block, and found out that the honest cost of a server-side check is a slower navigation.

## What we learned

That the interesting engineering in a legal product is not the AI. It is deciding what the
system is allowed to claim. Two rules did more for the quality of this build than any model
choice: **one deterministic core** that is pure enough to test and to time-travel, and **one
write path** for the event log, so every conclusion in the UI is reproducible from the log
alone.

We also learned to like boring evidence. A hash chain and a Merkle root are a few dozen lines of
code, and they turn "trust us, the mould was reported in March" into a claim anyone can check
without trusting us at all — which is the only version of this product a landlord and a tenant
would ever both agree to.

*Docket gives legal information, not legal advice. England only.*
