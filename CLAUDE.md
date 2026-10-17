@AGENTS.md

# Docket

Hackathon project (IKU Hack, KCL/Imperial/UCL, Oct 2026), team of two. **Track: Wise "Max Ease"** — remove friction from an everyday process. Side prizes we're targeting: ElevenLabs (voice), Tiger Data (Postgres/Timescale), Solana. Judged on: technical execution, utility & friction removal, business potential & user impact, innovation.

**What it is:** a two-sided, legally-aware record for UK rental repairs (England only). Tenants report any problem (mould, leak, broken boiler, dishwasher…) in seconds by voice in any language or by photo. Docket works out the legal duty and deadline, runs the workflow (acknowledge → access → investigate → fix → confirm), holds *both* sides accountable (landlord deadlines; tenant access duties), stores tamper-evident evidence, and generates escalation letters if a deadline is missed. Consumer-facing (free for tenants); landlords are the eventual paying side (B2B2C).

Pillars to pitch against: transparency, convenience, price, speed, coverage.

## Architecture (read before changing anything)

- **Event-sourced cases.** A case is an append-only log in `case_events` (hash-chained per case). All state is derived. The only write path is `src/lib/cases/service.ts#appendEvent` → re-project → diff → store `case_revisions`.
- **Engine is pure and deterministic** (`src/lib/engine/`): `project(events, {now, law, landlordType})` → `CaseState`. No I/O, no LLM. Fully unit-tested (`npm test`). Keep it that way.
  - `beliefs.ts` — facts come from sources with reliability; latest per source wins; close disagreements become **conflicts**; severity conflicts resolve **safety-first**.
  - `rules.ts` — facts + events → obligations, each with `basis` (the facts it rests on) so `diff.ts` can explain *why* a conclusion was dropped. That explanation is the core of the demo.
  - `law.ts` — **every legal number, citation and commencement date lives here.** Items marked VERIFY must be checked on legislation.gov.uk. `statutory: false` = Docket target; the UI must never present targets as legal deadlines.
  - `working-days.ts` — England & Wales bank holidays, Europe/London day boundaries.
- **Gemini models:** default `gemini-3.8-flash` (2.5 is retired for new keys). Free tier = 5 req/min per model, so `generateStructured` retries then falls back through `GEMINI_FALLBACK_MODELS`. Change prompts only with `npm run eval:intake` (paced to the free tier, ~3 min).
- **LLM boundary:** Gemini (`src/lib/ai/`) only *extracts facts* (as `FACT_ASSERTED` with an `ai_text`/`ai_vision`/`tenant` source). It never decides duties or deadlines. Letters are templated from engine output (`src/lib/escalation/`).
- **Domain contract:** `src/lib/domain/types.ts` (zod). Event types, fact keys, categories. Changing it affects both teammates — coordinate.
- **Time travel:** all "now" comes from `getNow()` (`src/lib/db/settings.ts`), which applies a demo clock offset. Law commencement overrides also live in `app_settings`. `/demo` drives both.
- **Integrations:**
  - Tiger Data: `db/migrations/*.sql` (hypertables: `case_events`, `case_revisions`, `sensor_readings`; continuous aggregate `sensor_hourly`). postgres.js client in `src/lib/db/client.ts`.
  - ElevenLabs: `src/lib/voice/elevenlabs.ts`. **Every paid call must go through `guardVoice()` (`src/lib/voice/budget.ts`)**, which enforces the credit reserve, daily session cap and `VOICE_ENABLED` kill switch. TTS is cached in `tts_cache`. Agent configured in the dashboard per `docs/VOICE_AGENT.md`; it calls `/api/voice/tools/*` (header `x-docket-tool-secret`). Browser uses `@elevenlabs/react` with a signed URL.
  - Solana: `src/lib/solana/anchor.ts` — Merkle root of evidence hashes + case-log heads written as a memo on **devnet only**. `/verify` checks a file against it.
- **Auth:** none yet — tenant/landlord views use fixed demo ids in `src/lib/demo.ts`. Don't build features that assume real auth.

## Next.js 16 specifics (Cache Components is ON)

- Any DB read in a server component must be inside `<Suspense>` and call `await connection()` first (see `src/app/landlord/page.tsx`). GET route handlers that read the DB also call `connection()`.
- `params` is a Promise: `const { id } = await params`. Use the generated `PageProps<"/route">` / `LayoutProps` helpers (`npx next typegen`).
- Check `node_modules/next/dist/docs/` before using an API you're unsure about.

## Commands

```
npm run db:up          # local TimescaleDB (docker) — or point DATABASE_URL at Tiger Cloud
npm run db:migrate     # apply db/migrations
npm run db:seed        # demo world (wipes demo data)
npm run dev
npm test               # engine + merkle unit tests
npm run typecheck
npm run sensors:simulate   # 14 days of damp readings for the hero flat
npm run solana:keygen      # devnet keypair → .env.local + airdrop
```

## Machine gotcha

Keep the repo outside iCloud-synced folders (Desktop, Documents); it lives at `~/dev/ikuhack`. When it was under `~/Documents`, iCloud offloaded files in `node_modules`, and every Node tool (tsx, next build, eslint) hung at near-zero CPU while macOS re-downloaded them. If a Node command hangs, check with `find node_modules -flags +dataless | head`.

## Conventions

- TypeScript strict, zod at every boundary (API input, LLM output).
- Comments explain *why*, briefly. Match existing density.
- New legal rule = add to `law.ts` + `rules.ts` + a scenario test in `engine.test.ts`.
- `TODO(person A)` / `TODO(person B)` markers map to `docs/WORKSPLIT.md`.
- Never commit `.env.local`. Never put real tenant data in seeds.

## Status

Scaffold complete: engine + tests, schema, all API routes, tenant/landlord/demo/verify pages, integration clients.

- **Working and verified:** typed and photo reporting against live Gemini (`npm run eval:intake` scores 14/14), migrations, seed and sensor simulation on the local Docker TimescaleDB, and `next build`. Vercel builds each PR.
- **Credit guard:** in place for ElevenLabs.
- **Person A's Milestone 1:** done.
- **Not yet run with live keys:** ElevenLabs voice and Solana anchoring.

See `docs/WORKSPLIT.md` for the task board.
