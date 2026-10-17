"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Hard stop for a single call, as a backstop to the agent's max-duration setting (credits are billed per minute). */
const MAX_CALL_MS = 3 * 60_000;

type Line = { role: "tenant" | "docket"; text: string };

/**
 * Multilingual voice intake via the ElevenLabs agent (configured by `npm run voice:setup`).
 * The agent's tools are client tools: they run here in the browser against our own API,
 * so voice works on localhost with no public URL. When the call ends, the transcript is
 * saved on the case as evidence, making the call part of the tamper-evident record.
 */
export function VoiceReport({ onFallback }: { onFallback?: () => void }) {
  return (
    <ConversationProvider>
      <VoiceInner onFallback={onFallback} />
    </ConversationProvider>
  );
}

function VoiceInner({ onFallback }: { onFallback?: () => void }) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Refs so the disconnect handler always sees the latest call state.
  const caseRef = useRef<string | null>(null);
  const linesRef = useRef<Line[]>([]);

  async function saveTranscript() {
    const id = caseRef.current;
    if (!id || linesRef.current.length === 0) return;
    const text = linesRef.current.map((l) => `${l.role === "tenant" ? "Tenant" : "Docket"}: ${l.text}`).join("\n");
    const form = new FormData();
    form.set("file", new File([text], "voice-report-transcript.txt", { type: "text/plain" }));
    form.set("actor", "tenant");
    form.set("kind", "transcript");
    form.set("caption", "Voice report transcript");
    const res = await fetch(`/api/cases/${id}/evidence`, { method: "POST", body: form });
    if (res.ok) setSaved(true);
  }

  const conversation = useConversation({
    onError: (message: string) => setError(message),
    onMessage: ({ message, source }) => {
      const line: Line = { role: source === "user" ? "tenant" : "docket", text: message };
      linesRef.current = [...linesRef.current, line];
      setLines(linesRef.current);
    },
    onDisconnect: () => void saveTranscript(),
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

  async function start() {
    setError(null);
    setSaved(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/voice/signed-url");
      const { signedUrl, error } = await res.json();
      if (!res.ok) throw new Error(error);
      caseRef.current = null;
      linesRef.current = [];
      setCaseId(null);
      setLines([]);
      conversation.startSession({ signedUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div className="text-center">
        <button
          onClick={live ? endSession : start}
          disabled={connecting}
          aria-label={live ? "End call" : "Start talking to Docket"}
          className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full font-semibold text-white transition disabled:opacity-60 ${
            live ? (conversation.isSpeaking ? "scale-105 bg-terracotta" : "bg-teal") : "bg-teal hover:bg-teal-dark"
          }`}
        >
          {live ? "End" : connecting ? "Connecting…" : "Tap to talk"}
        </button>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {live ? (conversation.isSpeaking ? "Docket is speaking…" : "Listening…") : "Speak in any language. Tell us what's wrong and where."}
        </p>
      </div>

      {lines.length > 0 && (
        <ol className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-cream-soft p-3 text-sm" aria-label="Live transcript">
          {lines.map((l, i) => (
            <li key={i} className={l.role === "tenant" ? "text-right" : ""}>
              <span className={`inline-block rounded-lg px-3 py-1.5 ${l.role === "tenant" ? "bg-teal text-white" : "bg-surface text-ink"}`}>
                {l.text}
              </span>
            </li>
          ))}
        </ol>
      )}

      {caseId && (
        <div className="rounded-lg border-2 border-teal bg-teal-tint p-3 text-center text-sm">
          <p className="font-medium">Your repair is logged{saved ? " and the call transcript is saved as evidence" : ""}.</p>
          <Link href={`/tenant/cases/${caseId}`} className="font-medium text-teal underline">See your landlord&apos;s deadline</Link>
        </div>
      )}

      {error && (
        <div className="space-y-2 text-center text-sm">
          <p className="text-danger">{error}</p>
          {onFallback && (
            <button onClick={onFallback} className="font-medium text-teal underline">Type your report instead</button>
          )}
        </div>
      )}
    </div>
  );
}
