"use client";

import { useEffect, useRef, useState } from "react";

/** Matches MAX_VOICE_NOTE_BYTES on the server (~2 min); stop early so the upload isn't rejected. */
const MAX_NOTE_MS = 110_000;

type State = "idle" | "recording" | "paused" | "transcribing" | "review";

/**
 * Record a voice note → ElevenLabs Scribe → editable text the tenant checks before it's added to the report.
 * Recording can be paused and resumed; only time spent recording counts towards the limit.
 * Cheaper than a live agent call, and works for tenants who'd rather not talk to a bot.
 */
export function VoiceNoteButton({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<State>("idle");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordedMs = useRef(0);
  const segmentStart = useRef(0);

  // Count only recording time (not paused time) and auto-stop at the limit.
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => {
      const total = recordedMs.current + (Date.now() - segmentStart.current);
      setElapsed(total);
      if (total >= MAX_NOTE_MS) recorder.current?.stop();
    }, 250);
    return () => clearInterval(t);
  }, [state]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        const form = new FormData();
        form.set("audio", new File(chunks, "voice-note.webm", { type: rec.mimeType || "audio/webm" }));
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) {
          setState("idle");
          return setError(body.error ?? "Couldn't transcribe that — please type instead.");
        }
        if (!body.text?.trim()) {
          setState("idle");
          return setError("We didn't catch anything — try again a little closer to the microphone.");
        }
        setDraft(body.text.trim());
        setState("review");
      };
      recordedMs.current = 0;
      segmentStart.current = Date.now();
      setElapsed(0);
      rec.start();
      recorder.current = rec;
      setState("recording");
    } catch {
      setError("Microphone not available — please type instead.");
    }
  }

  function pause() {
    recorder.current?.pause();
    recordedMs.current += Date.now() - segmentStart.current;
    setState("paused");
  }

  function resume() {
    segmentStart.current = Date.now();
    recorder.current?.resume();
    setState("recording");
  }

  const seconds = Math.floor(elapsed / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  if (state === "review") {
    return (
      <div className="space-y-2 rounded-lg border border-teal bg-teal-tint p-3">
        <label className="block text-sm font-medium text-ink" htmlFor="voice-note-draft">
          Here&apos;s what we heard. Fix anything that&apos;s wrong:
        </label>
        <textarea
          id="voice-note-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-surface p-2 text-sm"
        />
        <div className="flex gap-2">
          <button onClick={() => setState("idle")} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">Discard</button>
          <button
            onClick={() => {
              if (draft.trim()) onText(draft.trim());
              setState("idle");
            }}
            className="flex-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
          >
            Add to my report
          </button>
        </div>
      </div>
    );
  }

  if (state === "recording" || state === "paused") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-terracotta bg-terracotta-tint px-3 py-2 text-sm">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full bg-terracotta ${state === "recording" ? "animate-pulse" : "opacity-40"}`} />
        <span className="font-mono text-terracotta-dark" aria-live="polite">
          {state === "paused" ? `Paused ${clock}` : `Recording ${clock}`}
        </span>
        <button
          onClick={state === "recording" ? pause : resume}
          className="ml-auto rounded-md border border-teal bg-surface px-3 py-1 font-medium text-teal hover:bg-teal-tint"
        >
          {state === "recording" ? "Pause" : "Resume"}
        </button>
        <button onClick={() => recorder.current?.stop()} className="rounded-md bg-teal px-3 py-1 font-semibold text-white hover:bg-teal-dark">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={start}
        disabled={state === "transcribing"}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-medium text-teal hover:border-teal hover:bg-teal-tint disabled:opacity-60"
      >
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-teal" />
        {state === "transcribing" ? "Writing it down…" : "Record a voice note instead"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
