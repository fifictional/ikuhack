"use client";

import { useRef, useState } from "react";

type State = "idle" | "loading" | "playing";

/** Reads an update aloud in the tenant's language (translated server-side, audio cached). */
export function ListenButton({ caseId, text }: { caseId: string; text: string }) {
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
        body: JSON.stringify({ caseId, text }),
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
        onClick={listen}
        disabled={state === "loading"}
        className="rounded-lg border border-teal px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal-tint disabled:opacity-60"
      >
        {state === "loading" ? "Loading…" : state === "playing" ? "■ Stop" : "🔊 Listen"}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
