# Legal sources

Every rule in Docket's engine is traced to an official UK source. The machine-readable register is [`src/lib/engine/sources.ts`](../src/lib/engine/sources.ts); the rules cite it by id, and each duty on screen links to its source. Last full check: **17 October 2026**, against legislation.gov.uk, gov.uk and justice.gov.uk.

England only. Docket gives legal information, not legal advice.

## What the rules rely on

| Source | What Docket takes from it | Deadline type |
|---|---|---|
| [Landlord and Tenant Act 1985 s11](https://www.legislation.gov.uk/ukpga/1985/70/section/11) | Landlord repairs structure, exterior, water, gas, electricity, sanitation, heating, hot water. s11(6): access on **24 hours' written notice** | Repair: Docket target ("reasonable time"). Access notice: **legal** |
| [LTA 1985 s9A](https://www.legislation.gov.uk/ukpga/1985/70/section/9A), inserted by the [Homes (Fitness for Human Habitation) Act 2018](https://www.legislation.gov.uk/ukpga/2018/34) | Keep the home fit for human habitation; not liable for tenant-caused unfitness | Docket target |
| [LTA 1985 s10A](https://www.legislation.gov.uk/ukpga/1985/70/section/10A), inserted by the [Social Housing (Regulation) Act 2023 s42](https://www.legislation.gov.uk/ukpga/2023/36/section/42) | Awaab's Law covenant for social housing; "all reasonable endeavours" defence | n/a (enabling) |
| [Hazards in Social Housing (Prescribed Requirements) (England) Regulations 2025, SI 2025/1042](https://www.legislation.gov.uk/uksi/2025/1042/contents/made) | Emergency: **24 hours** (reg 5). Significant: investigate **10 working days** (reg 6), written summary **3 working days** (reg 9), start safety work **5 working days** (reg 11). Working days exclude weekends, Christmas Day, Good Friday, bank holidays (reg 2). Phase 1 covers damp and mould (significant) and all hazards except overcrowding (emergency) (reg 3) | **Legal** |
| [Awaab's Law Phase 2 guidance (gov.uk)](https://www.gov.uk/government/publications/awaabs-law-phase-2-guidance-for-social-housing-landlords/awaabs-law-phase-2-guidance-for-social-landlords) | From **30 November 2026**: excess cold, excess heat, falls, structural collapse, fire and explosions, electrical, domestic hygiene | **Legal**, once in force |
| [Smoke and Carbon Monoxide Alarm (England) Regulations 2015 reg 4](https://www.legislation.gov.uk/uksi/2015/1693/regulation/4), as amended by SI 2022/707 | Repair or replace a reported faulty alarm "as soon as reasonably practicable" | Docket target (24h) |
| [Pre-Action Protocol for Housing Conditions Claims (England)](https://www.justice.gov.uk/courts/procedure-rules/civil/protocol/prot_hou) | Letter of claim contents (para 5.2); landlord normally replies within **20 working days**; single joint expert | **Legal** (court protocol) |
| Warren v Keen [1954] 1 QB 15 (CA) | Tenant must use the home in a "tenant-like manner" | Docket target |
| [Legal Services Act 2007 s12](https://www.legislation.gov.uk/ukpga/2007/29/section/12) | Conduct of litigation is reserved, so Docket drafts but never litigates | n/a |
| [GOV.UK bank holidays](https://www.gov.uk/bank-holidays.json) | Working-day calculations (2025–2027 match exactly) | n/a |

## Corrections made after the check
- **Phase 2 hazards:** added excess heat and falls; removed *entry by intruders*, which isn't in Phase 2. Set the real start date of 30 November 2026.
- **Smoke alarm amendment:** cited correctly as SI 2022/707.
- **"Legal deadline" wording:** s11 and s9A set a legal *duty* but no fixed period, so Docket now labels those deadlines as its own targets. Only fixed periods in law (Awaab's Law, the 24h access notice, the protocol's 20 working days) are called legal deadlines. The landlord dashboard's "legal deadlines missed" count only includes those.

## Open caveats: tell judges honestly
- **Phase 2 status:** amending regulations were laid on 13 July 2026 and are "subject to Parliamentary approval". Confirm they've been made before relying on Phase 2 after 30 November 2026.
- **Smoke alarms in social housing:** whether the alarm regulations cover social tenancies depends on the Schedule to the 2015 Regulations as amended; not yet confirmed.
- **Awaab reg 5 start time:** the 24 hours runs from when an emergency is suspected or confirmed; Docket starts it at the tenant's report, which is the cautious reading.
- **Not modelled:** temporary rehousing (Part 6), and the lease-scope rules (ss13–14 for s11, s9B for s9A).
- **Awaab's Law for private renting:** at consultation stage only, so not in force.
