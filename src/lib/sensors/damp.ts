import { db } from "@/lib/db/client";
import { appendEvent } from "@/lib/cases/service";
import { getNow } from "@/lib/db/settings";

/**
 * Turns the sensor stream into a fact the engine can reason over.
 * Rule (Docket heuristic, tune it): ≥ 5 of the last 14 nights had an hour with
 * relative humidity ≥ 70% in the same room → persistent damp.
 */
export const DAMP_RH_THRESHOLD = 70;
export const DAMP_NIGHTS_THRESHOLD = 5;

export async function dampNights(propertyId: string, now: Date) {
  return db()`
    SELECT room, count(DISTINCT date_trunc('day', bucket AT TIME ZONE 'Europe/London')) AS nights
    FROM sensor_hourly
    WHERE property_id = ${propertyId}
      AND bucket > ${now}::timestamptz - INTERVAL '14 days' AND bucket <= ${now}
      AND extract(hour FROM bucket AT TIME ZONE 'Europe/London') BETWEEN 0 AND 6
      AND max_rh >= ${DAMP_RH_THRESHOLD}
    GROUP BY room`;
}

/** Evaluate damp for a property and assert the fact on its open damp/leak cases. */
export async function evaluateDamp(propertyId: string) {
  const now = await getNow();
  const rooms = await dampNights(propertyId, now);
  const worst = rooms.reduce((a, r) => (Number(r.nights) > Number(a?.nights ?? 0) ? r : a), rooms[0]);
  if (!worst || Number(worst.nights) < DAMP_NIGHTS_THRESHOLD) return { persistent: false, rooms };

  const cases = await db()`
    SELECT id FROM cases
    WHERE property_id = ${propertyId}
      AND coalesce(state->>'phase', '') NOT IN ('closed', 'resolved')
      AND state->'facts'->'issue.category'->>'value' IN ('damp_mould', 'leak')
      AND coalesce(state->'facts'->'hazard.dampPersistent'->>'value', 'false') <> 'true'`;
  for (const c of cases) {
    await appendEvent(c.id, "system", {
      type: "FACT_ASSERTED",
      key: "hazard.dampPersistent",
      value: true,
      source: { kind: "sensor", ref: `${propertyId}:${worst.room}`, label: `${worst.room} humidity sensor` },
      note: `${worst.nights} of the last 14 nights above ${DAMP_RH_THRESHOLD}% RH`,
    });
  }
  return { persistent: true, rooms, casesUpdated: cases.length };
}
