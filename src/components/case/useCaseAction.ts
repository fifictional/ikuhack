"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Actor, EventBody } from "@/lib/domain/types";
import { captureMethodOf } from "@/lib/evidence/live";

export type FixCheckResponse = {
  status?: "recorded" | "unclear" | "skipped";
  reason?: string;
  result?: { verdict: "fixed" | "not_fixed" | "unclear"; confidence: number; observations: string; remainingProblems: string[] };
  error?: string;
};

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
    form.set("capture", captureMethodOf(file));
    if (caption) form.set("caption", caption);
    const res = await fetch(`/api/cases/${caseId}/evidence`, { method: "POST", body: form });
    if (!res.ok) setError((await res.json()).error ?? "Upload failed");
    startTransition(() => router.refresh());
  }

  /** Ask Gemini to compare the tenant's "before" photos with the contractor's "after" photos. */
  async function checkFix(): Promise<FixCheckResponse> {
    setError(null);
    const res = await fetch(`/api/cases/${caseId}/check-fix`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) setError(body.error ?? "Photo check failed");
    startTransition(() => router.refresh());
    return body;
  }

  return { send, upload, checkFix, pending, error };
}
