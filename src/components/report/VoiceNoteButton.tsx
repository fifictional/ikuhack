"use client";

import { useRef, useState } from "react";

/** Matches MAX_VOICE_NOTE_BYTES on the server (~2 min); stop early so the upload isn't rejected. */
const MAX_NOTE_MS = 110_000;

/**
 * Record a voice note → ElevenLabs Scribe → text appended to the report box.
 * Cheaper than a live agent call, and works for tenants who'd rather not talk to a bot.
 */
export function VoiceNoteButton({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearTimeout(timer.current);
        setState("transcribing");
        const form = new FormData();
        form.set("audio", new File(chunks, "voice-note.webm", { type: rec.mimeType || "audio/webm" }));
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const body = await res.json();
        setState("idle");
        if (!res.ok) return setError(body.error ?? "Couldn't transcribe that — please type instead.");
        if (body.text?.trim()) onText(body.text.trim());
      };
      rec.start();
      recorder.current = rec;
      setState("recording");
      timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_NOTE_MS);
    } catch {
      setError("Microphone not available — please type instead.");
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => (state === "recording" ? recorder.current?.stop() : start())}
        disabled={state === "transcribing"}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium disabled:opacity-60 ${
          state === "recording" ? "border-terracotta bg-terracotta-tint text-terracotta-dark" : "border-border bg-surface text-teal hover:border-teal hover:bg-teal-tint"
        }`}
      >
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${state === "recording" ? "animate-pulse bg-terracotta" : "bg-teal"}`} />
        {state === "recording" ? "Recording… tap to stop" : state === "transcribing" ? "Writing it down…" : "Record a voice note instead"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
