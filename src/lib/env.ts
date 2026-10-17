/**
 * Lazy env access: a missing key only throws when the feature that needs it runs,
 * so you can work on the UI without every API key configured.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} — see docs/SETUP.md`);
  return v;
}

export const env = {
  get DATABASE_URL() { return required("DATABASE_URL"); },
  get GEMINI_API_KEY() { return required("GEMINI_API_KEY"); },
  get GEMINI_MODEL() { return process.env.GEMINI_MODEL || "gemini-3.8-flash"; },
  get GEMINI_FALLBACK_MODELS() {
    // The default model is always the last resort, so a bad GEMINI_MODEL setting can't take intake down.
    const list = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-3.1-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);
    return [...list, "gemini-3.8-flash"];
  },
  get GEMINI_THINKING() { return process.env.GEMINI_THINKING || "LOW"; },
  get ELEVENLABS_API_KEY() { return required("ELEVENLABS_API_KEY"); },
  get ELEVENLABS_AGENT_ID() {
    if (!process.env.ELEVENLABS_AGENT_ID) throw new Error("No voice agent yet: run `npm run voice:setup` to create it (see docs/VOICE_AGENT.md)");
    return process.env.ELEVENLABS_AGENT_ID;
  },
  get ELEVENLABS_WEBHOOK_SECRET() { return required("ELEVENLABS_WEBHOOK_SECRET"); },
  get ELEVENLABS_VOICE_ID() { return process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; },
  get DOCKET_TOOL_SECRET() { return required("DOCKET_TOOL_SECRET"); },
  get SOLANA_RPC_URL() { return process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com"; },
  get SOLANA_CLUSTER() { return process.env.SOLANA_CLUSTER ?? "devnet"; },
  get SOLANA_SECRET_KEY() { return required("SOLANA_SECRET_KEY"); },
};
