# Work split (two full-stack people, split by feature slice)

The interface between you is `src/lib/domain/types.ts` (events, facts) and the case service (`appendEvent`). Agree any change to either in chat before pushing.

- **Person A, "Tenant & voice":** owns the Max Ease story. It's everything the tenant touches, plus ElevenLabs and Gemini.
- **Person B, "Landlord, engine & proof":** owns the rigour story. That's the legal engine, Tiger Data, Solana, the landlord dashboard and the demo controls.

## Milestone 0: setup (together, ~1h)
- [ ] Both: `npm install`, `.env.local`, app runs locally (docs/SETUP.md §1)
- [ ] B: Tiger Cloud service, `db:migrate` + `db:seed` against it, share `DATABASE_URL`
- [ ] A: Gemini key; ElevenLabs key + credits
- [ ] B: deploy to Vercel (gives A a public URL for agent tools)
- [ ] B: `npm run solana:keygen`, share the devnet key

## Milestone 1: one end-to-end slice
Done when a typed report shows up on the landlord dashboard with a live clock.

**A**
- [x] `/tenant/report` text + photo flow working against real Gemini; prompt tuned with `npm run eval:intake` (14 reports, 5 languages, 14/14). Photo path not yet tried with a real photo
- [x] Answer `followUpQuestions` inline before submitting
- [x] Tenant case page: mobile layout, plain-English wording for duties

**B**
- [ ] Check every `VERIFY` in `src/lib/engine/law.ts` on legislation.gov.uk, and fix the numbers and tests
- [ ] Landlord actions end to end (acknowledge → access → findings → works), checking revisions read well
- [ ] `/api/tick` (recompute all) plus a Vercel cron, then drop `recomputeAll()` from the dashboard render

## Milestone 2: the differentiators
**A (ElevenLabs)**
- [x] Agent created from code (`npm run voice:setup`); browser client tools create the case and link to it. Needs a live test with a real key
- [x] Call transcript saved as case evidence from the browser when the call ends (no webhook needed)
- [x] Voice note → Scribe → fills the textarea (`/api/transcribe`). Needs a live test with a real key
- [ ] "Listen" button on case updates: Gemini translate into the tenant's `preferred_language`, then `/api/tts`
- [ ] Tenancy agreement upload → Gemini parse → `properties.tenancy` + facts (`TODO(person A)` in `intake.ts`)

**B (Tiger Data + Solana + engine)**
- [ ] Sensor chart on the landlord case page (`GET /api/sensors`, from the `sensor_hourly` continuous aggregate)
- [ ] Excess-cold rule from `min_temp` (heating cases), mirroring `src/lib/sensors/damp.ts`
- [ ] Recurring compliance duties: gas safety record (annual), EICR (5-yearly), each with a 28-day copy to the tenant
- [ ] Anchoring on a schedule; `/verify` polished; anchor link in the bundle
- [ ] Revisions timeline on the case page, showing "what Docket believed at time T" from `case_revisions`

## Milestone 3: demo polish (together)
- [ ] Rehearse `docs/DEMO.md` end to end on the deployed URL, at least 3 times
- [ ] Seed data tuned for the story; demo panel buttons in pitch order
- [ ] Devpost write-up, screenshots, a 2-minute video as backup
- [ ] Pitch: problem → live demo → how it works (engine slide) → business model

## Stretch
- Twilio phone line on the agent (A)
- Real sign-in with a magic link (B)
- Contractor mobile view: check-in with a geotagged photo (B)
- Private-landlord mode: email notices for landlords not on Docket (A)

## Git
- Branch per task: `a/voice-intake`, `b/sensor-chart`. Small PRs into `main`; review each other's quickly.
- `main` must always deploy. Run `npm test && npm run typecheck` before pushing.
- Avoid both editing the same file. Shared hot spots are `types.ts`, `CaseView.tsx` and `service.ts`, so announce before touching them.
