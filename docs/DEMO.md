# Demo script (~3 min)

Setup: `db:seed`, clock reset, two browser windows side by side: **tenant (phone-sized)** on the left, **landlord dashboard** on the right.

1. **Hook (15s).** "About one in eleven homes in England, 2.3 million of them, has a serious hazard. In private rentals, one in five fails the Decent Homes Standard. When something breaks, tenants don't know their rights and landlords lose track of deadlines. Now that's a legal breach." (Sources and exact figures in the **Statistics sources** section below. Say "official government survey, 2024".)
2. **Report by voice (40s).** The tenant taps *Speak* and describes black mould in the bedroom in Polish. The agent asks one follow-up, logs it, and reads back the landlord's deadline. The landlord window shows the new case with an Awaab's Law clock.
3. **The agent adapts (60s).**
   - The tenant taps *Someone at home is vulnerable* → the case becomes a **24h emergency**, and the revision feed explains why.
   - Second case: the dishwasher "won't drain". The contractor records a leak into the subfloor → the **appliance duty is dropped, s11 repair duty added**, with the reason given.
4. **Accountability on both sides (20s).** The tenant misses an access slot → the landlord's clock **pauses** and the tenant's duty shows as missed.
5. **Deadline missed (30s).** `/demo` +1 week → breach → the tenant sees *Letter of claim*, a pre-filled pre-action protocol letter plus a PDF evidence bundle.
6. **Proof (25s).** Landlord dashboard → *Record an inspection* (attach a certificate) → it is anchored on Solana within seconds → open **/proof**: "✓ Verified live on Solana", the Explorer link, and the Merkle diagram. Then `/verify` with the same file shows ✓ confirmed on-chain. Run `npm run solana:check` beforehand to confirm the wallet is funded.
7. **Law changes (10s).** `/demo` → *Commence Awaab phase 2* → the heating case on the dashboard gains statutory clocks instantly.
8. **Close (10s).** Free for tenants; landlords pay per home for provable compliance.

## Statistics sources (verified 18 Oct 2026)

All figures are from one official source: the **English Housing Survey 2024-25, headline report on housing quality and energy efficiency**, published by the Ministry of Housing, Communities and Local Government on 29 January 2026 (an Accredited Official Statistic). The data year is 2024. Each number was checked against the published report text.

- Report page: https://www.gov.uk/government/statistics/chapters-for-english-housing-survey-2024-to-2025-headline-findings-on-housing-quality-and-energy-efficiency/chapter-1-housing-quality
- Report PDF: https://assets.publishing.service.gov.uk/media/697a0f35005d288bf850deb2/2024-25_EHS_Headline_Report_on_Housing_Quality_and_Energy_Efficiency.pdf

| Claim | Figure (2024) | Where in the report |
|---|---|---|
| Homes in England with a serious (HHSRS Category 1) hazard | **9%, or 2.3 million dwellings** (about 1 in 11) | Chapter 1, Hazards (Annex Table 1.6) |
| Private rented homes failing the Decent Homes Standard | **22%, or 1.1 million dwellings** (about 1 in 5) | Chapter 1, Decent Homes (Annex Table 1.4) |
| Private rented homes with a damp problem | **10%** (social rented 7%, owner occupied 4%) | Chapter 1, Damp (Annex Table 1.9) |
| All homes failing the Decent Homes Standard | **15%, or 4.0 million dwellings** | Chapter 1, Decent Homes |

How to describe them honestly if asked:
- They are survey estimates from physical inspections of a sample of homes, not a count of every home.
- "Serious hazard" means a Category 1 hazard under the Housing Health and Safety Rating System, the most serious category. A home with one fails the statutory minimum standard.
- "Damp" means damp the surveyor judged significant enough to feed into the hazard assessment; minor damp is not counted.
- The survey says damp rose from 4% in 2021-22 to 5% in 2024 across all homes, but notes comparisons with 2020-22 should be made with caution because modelled data was used in those years. Use "damp is rising" only with that caveat, or leave it out.

