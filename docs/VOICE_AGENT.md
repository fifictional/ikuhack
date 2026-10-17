# ElevenLabs voice agent

## Setup (one command)
1. Put `ELEVENLABS_API_KEY` in `.env.local`. The key needs these permissions: Agents, Text-to-Speech, Speech-to-Text, User: read.
2. Run `npm run voice:setup`. This creates the agent from `scripts/setup-voice-agent.ts`, covering prompt, tools, languages and cost limits, and saves `ELEVENLABS_AGENT_ID` to `.env.local`. Re-run it after editing the script to update the agent.
3. Set `VOICE_ENABLED=true` while testing voice; set it back to `false` when you're done.
4. Go to `/tenant/report` → **Speak**.

**How it works:**
- The agent's tools (`report_issue`, `get_case_status`) are **client tools**. The browser runs them against our own API (`/api/voice/report`, `/api/voice/status`), so voice works on `localhost` with no public URL, tunnel or webhook.
- The live transcript shows on screen, and when the call ends it is saved on the case as evidence.
- **Voice notes:** the "Record a voice note instead" button on the typed form uses Scribe (`/api/transcribe`), which is cheaper than an agent call.
- **The agent's LLM is Gemini** (`gemini-3.5-flash`), set in the setup script.

The sections below describe the prompt and settings the script applies. Edit the script, not the dashboard; dashboard edits get overwritten on the next `voice:setup`.

## Basics
- **Name:** Docket intake
- **Languages:** English default; enable automatic language detection plus Polish, Arabic, Urdu, Bengali, Romanian, Spanish, Somali (common in UK social housing — adjust).
- **Voice:** a warm, calm multilingual voice.
- **First message:** "Hi, this is Docket. Tell me what's wrong at home, in whatever language is easiest for you."
- **Security:** enable authentication (we connect with a signed URL from `/api/voice/signed-url`).

## System prompt

```
You are Docket, helping a tenant in England report a problem with their rented home.
Be warm, brief and practical. Speak the tenant's language.

Goal: collect enough to log the issue, then call report_issue.
Ask, one at a time, only what's missing:
1. What is the problem and where in the home?
2. How long has it been happening? Is it getting worse?
3. Is anyone at home especially vulnerable — a baby, young child, older person, someone ill or disabled?
4. Is anyone in immediate danger (gas smell, sparks, water near electrics, no heat in freezing weather)?
   If gas smell: tell them to call the National Gas Emergency line on 0800 111 999 now, then continue.

Then call report_issue with a full English description. Read back the message it returns.
Then call show_case with the case_id so it appears on their screen.
If they ask about an existing repair, call get_case_status and summarise the next deadline in plain words.
Never give legal advice or promise outcomes. Say "Docket will track your landlord's deadline".
```

## Tools

**Phone line only (stretch):** a Twilio number can't run client tools, so it uses the webhook versions below, which need a public URL.

**report_issue** (webhook, POST `https://<public-url>/api/voice/tools/report-issue`)
- Header: `x-docket-tool-secret: <DOCKET_TOOL_SECRET>`
- Body params:
  - `description` (string, required) — everything the tenant said about the problem, in English
  - `original_language` (string) — ISO code of the language spoken
  - `vulnerable_occupant` (boolean)

**get_case_status** (webhook, POST `https://<public-url>/api/voice/tools/case-status`)
- Header: `x-docket-tool-secret: <DOCKET_TOOL_SECRET>`
- Body params: `case_id` (string, optional)

**show_case** (client tool — handled in `src/components/report/VoiceReport.tsx`)
- Params: `case_id` (string, required)

## Webhook
Post-call transcription → `https://<public-url>/api/webhooks/elevenlabs`. Copy the signing secret to `ELEVENLABS_WEBHOOK_SECRET`.

## Credit protection: set these before testing
Agent calls are billed per minute, so they're the biggest risk to the demo budget.

**In the ElevenLabs dashboard**
- Agent → Advanced → **max conversation duration: 180s**. The browser also hangs up at 3 min as a backstop.
- Agent → **end the call after ~15s of silence**, so a tab left open doesn't keep billing.
- Agent → LLM: pick a cheap, fast model (a Gemini Flash option if listed).
- Agent → Security: **authentication on**. Only our server can start calls (via a signed URL), so a leaked agent ID can't be abused.
- API key: grant **User: read** so the app can see your remaining balance. If the key settings offer a credit limit, set one too.

**In the app** (`src/lib/voice/budget.ts`, all via `.env.local`)
- `VOICE_ENABLED=false` keeps voice off; keep it off unless you're working on voice.
- `ELEVENLABS_RESERVE_CREDITS`: calls are refused (HTTP 429, the UI falls back to typing) once the balance would drop below this. Default 10,000. On demo day, set it to ~1,000.
- `ELEVENLABS_MAX_SESSIONS_PER_DAY`: caps conversations per day (default 20).
- TTS uses the cheaper Flash model, is capped at 600 characters, and is **cached**, so rehearsing the same read-out is free after the first time.
- Voice notes are capped at ~2 minutes.
- `/demo` → **Check remaining credits** shows balance, reserve and today's session count.

**Habits**
- Test the agent with short calls; test the rest of the flow by typing.
- Do one full voice rehearsal the night before, check credits on `/demo`, then leave voice alone until the demo.

## Stretch: phone line
Dashboard → Phone numbers → import a Twilio number and assign this agent. A real phone number makes the "no app, no English needed" pitch land.
