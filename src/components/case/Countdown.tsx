"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/I18n";

/**
 * Live countdown to a deadline. `serverNow` is the (possibly time-travelled)
 * demo clock at render time; we tick forward from there.
 */
export function Countdown({ dueAt, serverNow }: { dueAt: string; serverNow: string }) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(dueAt).getTime() - (new Date(serverNow).getTime() + elapsed);
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const [D, H, M] = [t("countdown.d"), t("countdown.h"), t("countdown.m")];
  const text = d > 0 ? `${d}${D} ${h}${H}` : h > 0 ? `${h}${H} ${m}${M}` : `${m}${M}`;
  return (
    <span className={`font-mono text-sm ${overdue ? "text-danger" : ms < 86_400_000 ? "text-warn" : "text-foreground"}`}>
      {t(overdue ? "countdown.overdue" : "countdown.left", { time: text })}
    </span>
  );
}
