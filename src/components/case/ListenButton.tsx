"use client";

import { useRef, useState } from "react";

type State = "idle" | "loading" | "playing";

/** Reads a case update aloud in the tenant's language (translated server-side, audio cached). */
export function ListenButton({ caseId, text, label = "🔊 Listen" }: { caseId: string; text: string; label?: string }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function listen() {
    if (state === "playing") {
      audio.current?.pause();
      setState("idle");
      return;
    }
    setError(null);
    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // /api/tts caps input at 600 chars (MAX_TTS_CHARS).
        body: JSON.stringify({ caseId, text: text.slice(0, 600) }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't play this");
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => { setState("idle"); URL.revokeObjectURL(url); };
      await a.play();
      setState("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't play this");
      setState("idle");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={listen}
        disabled={state === "loading"}
        className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-tint disabled:opacity-60"
      >
        {state === "loading" ? "Loading…" : state === "playing" ? "■ Stop" : label}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
