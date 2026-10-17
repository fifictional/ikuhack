# Setup

Do this together in the first hour. Each person needs their own `.env.local` (copy `.env.example`); share keys over a private channel, never in git.

## 1. Run it locally (no keys needed yet)

```bash
npm install
cp .env.example .env.local
npm run db:up        # needs Docker Desktop; or skip and use Tiger Cloud (step 2)
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3000
```

The landlord dashboard and case pages work with just a database. AI, voice and anchoring need the keys below.

## 2. Accounts and keys

| What | Where | Env var(s) | Who |
|---|---|---|---|
| **Tiger Data** (Postgres + TimescaleDB) | Sign up via the MLH link `mlh.link/tigerdata` → create a service → copy the connection string | `DATABASE_URL` | Person B creates; share the URL |
| **Gemini** | aistudio.google.com → Get API key. Pick the newest Flash model available and set it | `GEMINI_API_KEY`, `GEMINI_MODEL` | Each person can use their own |
| **ElevenLabs** | elevenlabs.io → API keys (enable Agents, Speech-to-Text, Text-to-Speech). Ask the ElevenLabs sponsor table for hackathon credits | `ELEVENLABS_API_KEY` | Person A |
| ElevenLabs agent | Dashboard → Agents → create agent using `docs/VOICE_AGENT.md` → copy agent ID | `ELEVENLABS_AGENT_ID` | Person A |
| ElevenLabs webhook | Dashboard → Agents → Webhooks → post-call → URL `https://<public-url>/api/webhooks/elevenlabs` → copy secret | `ELEVENLABS_WEBHOOK_SECRET` | Person A |
| Tool secret | Any long random string (`openssl rand -hex 24`). Also set as a header on each agent tool | `DOCKET_TOOL_SECRET` | Person A |
| **Solana devnet** | `npm run solana:keygen` (writes the key to `.env.local` and requests an airdrop; if rate-limited use faucet.solana.com) | `SOLANA_SECRET_KEY` | Person B; share the same key so anchors come from one wallet |
| **Vercel** (hosting) | vercel.com → import the GitHub repo → add all env vars | — | Person B |

Runware: not used. Skip it unless you add illustrated explainers later.

## 3. Public URL for ElevenLabs

The agent's server tools and webhook need to reach your server.
- Easiest: deploy to Vercel early and point the agent at the Vercel URL.
- Local testing: `ngrok http 3000` and use the https URL (it changes on each restart, so update the agent tools).

## 4. Smoke test

1. `/landlord` shows 3 seeded cases with clocks.
2. `/tenant/report` → "Type & photos" → submit → case page shows duties. (Needs Gemini.)
3. `/demo` → "Stream damp readings" → hero flat's damp case flips to safety-first severity. (Needs a damp case first.)
4. `/demo` → "Anchor" → Solana Explorer link in the log; `/verify` accepts an uploaded photo.
5. `/tenant/report` → "Speak" → agent answers and creates a case. (Needs ElevenLabs + a public URL.)
