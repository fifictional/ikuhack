# Docket

**Every rental repair, on the clock and on the record.**

IKU Hack 2026, Wise "Max Ease" track. Tenants report any repair in seconds, by voice in any language or by photo. Docket works out the landlord's legal duty and deadline, holds both sides to account, keeps tamper-evident evidence, and drafts the escalation letter if a deadline is missed.

- Stack: Next.js 16, Gemini, ElevenLabs Agents/Scribe/TTS, Tiger Data (TimescaleDB), Solana devnet
- Setup: [docs/SETUP.md](docs/SETUP.md)
- Who does what: [docs/WORKSPLIT.md](docs/WORKSPLIT.md)
- Demo script: [docs/DEMO.md](docs/DEMO.md)
- Architecture & conventions: [CLAUDE.md](CLAUDE.md)

```bash
npm install && cp .env.example .env.local
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev
```

Docket provides legal information, not legal advice.
