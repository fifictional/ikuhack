"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Actor, EventBody } from "@/lib/domain/types";

/** Post an event to a case, then refresh the server components. */
export function useCaseAction(caseId: string, actor: Actor) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function send(event: EventBody) {
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actor, event }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Something went wrong");
    startTransition(() => router.refresh());
  }

  async function upload(file: File, caption?: string) {
    const form = new FormData();
    form.set("file", file);
    form.set("actor", actor);
    form.set("kind", file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : "document");
    if (caption) form.set("caption", caption);
    const res = await fetch(`/api/cases/${caseId}/evidence`, { method: "POST", body: form });
    if (!res.ok) setError((await res.json()).error ?? "Upload failed");
    startTransition(() => router.refresh());
  }

  return { send, upload, pending, error };
}
