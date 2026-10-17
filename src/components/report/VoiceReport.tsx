"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CALL_LANGUAGES, type CallLanguageCode } from "@/lib/voice/languages";

/** Hard stop for a single call, as a backstop to the agent's max-duration setting (credits are billed per minute). */
const MAX_CALL_MS = 3 * 60_000;
/** While paused, ping activity so the agent's 20s silence hang-up doesn't end the call. */
const KEEPALIVE_MS = 8_000;

/** `heard` is what speech-to-text produced; kept when the tenant corrects it, so the record shows both. */
type Line = { role: "tenant" | "docket"; text: string; heard?: string };

/**
 * Multilingual voice intake via the ElevenLabs agent (configured by `npm run voice:setup`).
 * The agent's tools are client tools: they run here in the browser against our own API,
 * so voice works on localhost with no public URL. The tenant can pause the call and correct
 * any caption; when the call ends the transcript (with corrections) is saved on the case.
 */
export function VoiceReport({ onFallback }: { onFallback?: () => void }) {
  return (
    <ConversationProvider>
      <VoiceInner onFallback={onFallback} />
    </ConversationProvider>
  );
}

function transcriptText(lines: Line[]) {
  return lines
    .map((l) =>
      l.role === "docket"
        ? `Docket: ${l.text}`
        : l.heard
          ? `Tenant (corrected by tenant): ${l.text}\n  [speech-to-text heard: "${l.heard}"]`
          : `Tenant: ${l.text}`,
    )
    .join("\n");
}

function VoiceInner({ onFallback }: { onFallback?: () => void }) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"no" | "saved" | "stale">("no");
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  // Refs so the disconnect handler always sees the latest call state.
  const caseRef = useRef<string | null>(null);
  const linesRef = useRef<Line[]>([]);
  const keepalive = useRef<ReturnType<typeof setInterval> | null>(null);

  const setAllLines = (next: Line[]) => {
    linesRef.current = next;
    setLines(next);
  };

  async function saveTranscript(caption = "Voice report transcript") {
    const id = caseRef.current;
    if (!id || linesRef.current.length === 0) return;
    const form = new FormData();
    form.set("file", new File([transcriptText(linesRef.current)], "voice-report-transcript.txt", { type: "text/plain" }));
    form.set("actor", "tenant");
    form.set("kind", "transcript");
    form.set("caption", caption);
    const res = await fetch(`/api/cases/${id}/evidence`, { method: "POST", body: form });
    if (res.ok) setSaved("saved");
  }

  const conversation = useConversation({
    onError: (message: string) => setError(message),
    onMessage: ({ message, source }) => setAllLines([...linesRef.current, { role: source === "user" ? "tenant" : "docket", text: message }]),
    onDisconnect: () => {
      stopKeepalive();
      setPaused(false);
      void saveTranscript();
    },
    clientTools: {
      report_issue: async (params: { description: string; original_language?: string; vulnerable_occupant?: boolean }) => {
        const res = await fetch("/api/voice/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(params),
        });
        const body = await res.json();
        if (!res.ok) return `Sorry, logging failed: ${body.error ?? "unknown error"}. Ask the tenant to type their report instead.`;
        caseRef.current = body.case_id;
        setCaseId(body.case_id);
        return body.message as string;
      },
      get_case_status: async () => {
        const res = await fetch("/api/voice/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(caseRef.current ? { case_id: caseRef.current } : {}),
        });
        return ((await res.json()).message as string) ?? "I couldn't find that repair.";
      },
    },
  });
  const live = conversation.status === "connected";
  const connecting = conversation.status === "connecting";
  const { endSession } = conversation;

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => {
      endSession();
      setError("Call ended after 3 minutes. Anything you said is saved on your case.");
    }, MAX_CALL_MS);
    return () => clearTimeout(t);
  }, [live, endSession]);

  useEffect(() => () => stopKeepalive(), []);

  function stopKeepalive() {
    if (keepalive.current) clearInterval(keepalive.current);
    keepalive.current = null;
  }

  function togglePause() {
    if (!paused) {
      conversation.setMuted(true);
      conversation.sendContextualUpdate("The tenant has paused the call. Stay completely silent until they say they're back.");
      keepalive.current = setInterval(() => conversation.sendUserActivity(), KEEPALIVE_MS);
      setPaused(true);
    } else {
      stopKeepalive();
      conversation.setMuted(false);
      conversation.sendContextualUpdate("The tenant has resumed the call. Briefly invite them to carry on.");
      setPaused(false);
    }
  }

  /** Replace a misheard caption; keep the original for the record and tell the agent what was meant. */
  function saveEdit() {
    if (!editing) return;
    const old = linesRef.current[editing.index];
    const text = editing.text.trim();
    setEditing(null);
    if (!old || !text || text === old.text) return;
    const next = [...linesRef.current];
    next[editing.index] = { ...old, text, heard: old.heard ?? old.text };
    setAllLines(next);
    if (live) {
      conversation.sendUserMessage(`Correction: you heard "${old.text}" but I meant: "${text}".`);
    } else if (saved === "saved") {
      setSaved("stale");
    }
  }

  const [language, setLanguage] = useState<CallLanguageCode>("en");

  async function start() {
    setError(null);
    setSaved("no");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/voice/signed-url");
      const { signedUrl, voices, error } = await res.json();
      if (!res.ok) throw new Error(error);
      const pick = CALL_LANGUAGES.find((l) => l.code === language);
      caseRef.current = null;
      setAllLines([]);
      setCaseId(null);
      conversation.startSession({
        signedUrl,
        // A chosen language sets recognition, voice and greeting for the whole call; "Any language" keeps the default.
        overrides: pick && pick.code !== "auto"
          ? { agent: { language: pick.code, firstMessage: pick.greeting }, ...(voices?.[pick.code] ? { tts: { voiceId: voices[pick.code] } } : {}) }
          : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div className="text-center">
        {!live && !connecting && (
          <div role="radiogroup" aria-label="Call language" className="mb-4 flex flex-wrap justify-center gap-2">
            {CALL_LANGUAGES.map((l) => (
              <button
                key={l.code}
                role="radio"
                aria-checked={language === l.code}
                onClick={() => setLanguage(l.code)}
                className={`rounded-full border px-3 py-1 text-sm ${language === l.code ? "border-primary bg-primary text-white" : "border-border bg-surface hover:border-primary"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={live ? endSession : start}
          disabled={connecting}
          aria-label={live ? "End call" : "Start talking to Docket"}
          className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full font-semibold text-white transition disabled:opacity-60 ${
            live && !paused && conversation.isSpeaking ? "scale-105 bg-highlight" : "bg-primary hover:bg-primary-dark"
          }`}
        >
          {live ? "End" : connecting ? "Connecting…" : "Tap to talk"}
        </button>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {!live
            ? language === "auto" ? "Speak in any language. Tell us what's wrong and where." : "Tap and tell us what's wrong and where."
            : paused
              ? "Paused: your microphone is off. Tap Resume when you're ready."
              : conversation.isSpeaking
                ? "Docket is speaking…"
                : "Listening…"}
        </p>
        {live && (
          <button
            onClick={togglePause}
            className={`mt-3 rounded-lg border px-4 py-2 text-sm font-medium ${
              paused ? "border-primary bg-primary text-white hover:bg-primary-dark" : "border-primary text-primary hover:bg-primary-tint"
            }`}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      {lines.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Tap anything you said to fix it if we heard it wrong.</p>
          <ol className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-background p-3 text-sm" aria-label="Transcript">
            {lines.map((l, i) =>
              editing?.index === i ? (
                <li key={i} className="space-y-2 text-right">
                  <textarea
                    autoFocus
                    value={editing.text}
                    onChange={(e) => setEditing({ index: i, text: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-primary bg-surface p-2 text-left"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1 text-xs">Cancel</button>
                    <button onClick={saveEdit} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark">Save correction</button>
                  </div>
                </li>
              ) : (
                <li key={i} className={l.role === "tenant" ? "text-right" : ""}>
                  {l.role === "tenant" ? (
                    <button
                      onClick={() => setEditing({ index: i, text: l.text })}
                      title="Edit what you said"
                      className="inline-block rounded-lg bg-primary px-3 py-1.5 text-left text-white hover:bg-primary-dark"
                    >
                      {l.text}
                      <span className="ml-2 text-xs text-white/80 underline">{l.heard ? "edited" : "edit"}</span>
                    </button>
                  ) : (
                    <span className="inline-block rounded-lg bg-surface px-3 py-1.5 text-ink">{l.text}</span>
                  )}
                </li>
              ),
            )}
          </ol>
        </div>
      )}

      {caseId && (
        <div className="space-y-1 rounded-lg border-2 border-primary bg-primary-tint p-3 text-center text-sm">
          <p className="font-medium">Your repair is logged{saved === "saved" ? " and the call transcript is saved as evidence" : ""}.</p>
          {saved === "stale" && (
            <button onClick={() => saveTranscript("Voice report transcript (corrected by tenant)")} className="font-medium text-primary underline">
              Save my corrections to the case
            </button>
          )}
          <Link href={`/tenant/cases/${caseId}`} className="block font-medium text-primary underline">See your landlord&apos;s deadline</Link>
        </div>
      )}

      {error && (
        <div className="space-y-2 text-center text-sm">
          <p className="text-danger">{error}</p>
          {onFallback && (
            <button onClick={onFallback} className="font-medium text-primary underline">Type your report instead</button>
          )}
        </div>
      )}
    </div>
  );
}
