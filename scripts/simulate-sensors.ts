import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db/client";
import { DEMO } from "@/lib/demo";
import { evaluateDamp } from "@/lib/sensors/damp";

/**
 * Backfills 14 days of 10-minute humidity/temperature readings for the demo flat.
 *   npm run sensors:simulate            → damp bedroom (nightly RH spikes)
 *   npm run sensors:simulate -- --dry   → healthy readings
 */
async function main() {
  const damp = !process.argv.includes("--dry");
  const sql = db();
  const rows: { property_id: string; room: string; ts: Date; humidity_pct: number; temp_c: number }[] = [];
  const end = Date.now();
  for (let t = end - 14 * 86_400_000; t <= end; t += 10 * 60_000) {
    const hour = new Date(t).getUTCHours();
    const night = hour <= 6;
    for (const room of ["bedroom", "living_room"]) {
      const base = room === "bedroom" && damp ? (night ? 78 : 64) : 52;
      rows.push({
        property_id: DEMO.tenantPropertyId,
        room,
        ts: new Date(t),
        humidity_pct: base + (Math.random() - 0.5) * 6,
        temp_c: (night ? 15.5 : 18.5) + (Math.random() - 0.5),
      });
    }
  }
  await sql`DELETE FROM sensor_readings WHERE property_id = ${DEMO.tenantPropertyId}`;
  for (let i = 0; i < rows.length; i += 1000) {
    await sql`INSERT INTO sensor_readings ${sql(rows.slice(i, i + 1000))}`;
  }
  await sql`CALL refresh_continuous_aggregate('sensor_hourly', NULL, NULL)`;
  console.log(`inserted ${rows.length} readings (${damp ? "damp" : "dry"})`);
  console.log(await evaluateDamp(DEMO.tenantPropertyId));
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
