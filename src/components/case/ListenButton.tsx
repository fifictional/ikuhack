"use client";

import { useRef, useState } from "react";
import { useLocale, useT } from "@/components/i18n/I18n";

type State = "idle" | "loading" | "playing";

/** Reads an update aloud in the tenant's language (translated server-side, audio cached). */
export function ListenButton({ caseId, text }: { caseId: string; text: string }) {
  const t = useT();
  // Speak in the language the page is shown in (falls back to the tenant's saved language server-side).
  const locale = useLocale();
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
        body: JSON.stringify({ caseId, text, lang: locale }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? t("listen.error"));
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => { setState("idle"); URL.revokeObjectURL(url); };
      await a.play();
      setState("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("listen.error"));
      setState("idle");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={listen}
        disabled={state === "loading"}
        className="rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-tint disabled:opacity-60"
      >
        {state === "loading" ? t("common.loading") : state === "playing" ? t("listen.stop") : t("listen.listen")}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
