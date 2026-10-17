import { db } from "./client";
import { DEFAULT_LAW, type LawConfig, withPhaseOverrides } from "@/lib/engine/law";

/** Demo time travel: all "now"s go through here so the demo panel can fast-forward. */
export async function getNow(): Promise<Date> {
  const [row] = await db()`SELECT value FROM app_settings WHERE key = 'clock_offset_ms'`;
  return new Date(Date.now() + Number(row?.value ?? 0));
}

export async function setClockOffset(ms: number) {
  await db()`INSERT INTO app_settings (key, value) VALUES ('clock_offset_ms', ${db().json(ms)})
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/** Law config with any demo overrides (e.g. "commence Awaab phase 2 now"). */
export async function getLaw(): Promise<LawConfig> {
  const [row] = await db()`SELECT value FROM app_settings WHERE key = 'law_overrides'`;
  return withPhaseOverrides(DEFAULT_LAW, (row?.value as Record<string, string | null>) ?? {});
}

export async function setLawOverride(phaseId: string, commencesAt: string | null) {
  const [row] = await db()`SELECT value FROM app_settings WHERE key = 'law_overrides'`;
  const next = { ...((row?.value as Record<string, string | null>) ?? {}), [phaseId]: commencesAt };
  await db()`INSERT INTO app_settings (key, value) VALUES ('law_overrides', ${db().json(next)})
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
