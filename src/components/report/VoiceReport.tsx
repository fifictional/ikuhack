"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import { useState } from "react";

/**
 * Multilingual voice intake via an ElevenLabs agent. The agent calls our
 * `report_issue` server tool, which creates the case; we show a link once it has.
 * Agent config (prompt, tools, languages) lives in the ElevenLabs dashboard — see docs/VOICE_AGENT.md.
 */
export function VoiceReport() {
  return (
    <ConversationProvider>
      <VoiceInner />
    </ConversationProvider>
  );
}

function VoiceInner() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conversation = useConversation({
    onError: (e: unknown) => setError(String(e)),
    // TODO(person A): pick up the case id from the report_issue tool result
    // (e.g. a client tool "show_case" the agent calls with case_id) and setCaseId.
    clientTools: { show_case: async ({ case_id }: { case_id: string }) => { setCaseId(case_id); return "shown"; } },
  });
  const live = conversation.status === "connected";

  async function start() {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/voice/signed-url");
      const { signedUrl, error } = await res.json();
      if (!res.ok) throw new Error(error);
      conversation.startSession({ signedUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6 text-center">
      <button
        onClick={live ? conversation.endSession : start}
        className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full text-white transition ${
          live ? (conversation.isSpeaking ? "scale-105 bg-accent" : "bg-accent/80") : "bg-foreground"
        }`}
      >
        {live ? "End" : "Tap to talk"}
      </button>
      <p className="text-sm text-muted">
        {live ? (conversation.isSpeaking ? "Docket is speaking…" : "Listening…") : "Speak in any language. Tell us what's wrong and where."}
      </p>
      {caseId && (
        <Link href={`/tenant/cases/${caseId}`} className="block text-accent underline">View your logged repair</Link>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
