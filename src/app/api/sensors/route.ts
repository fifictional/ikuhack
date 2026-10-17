import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { getNow } from "@/lib/db/settings";
import { handle } from "@/lib/http";
import { evaluateDamp } from "@/lib/sensors/damp";

const Ingest = z.object({
  propertyId: z.string().uuid(),
  readings: z
    .array(z.object({ room: z.string(), ts: z.string(), humidity_pct: z.number().optional(), temp_c: z.number().optional() }))
    .max(5000),
});

/** Ingest readings from a sensor gateway, then re-evaluate damp for the property. */
export const POST = handle(async (req: Request) => {
  const { propertyId, readings } = Ingest.parse(await req.json());
  if (readings.length) {
    const rows = readings.map((r) => ({
      property_id: propertyId,
      room: r.room,
      ts: new Date(r.ts),
      humidity_pct: r.humidity_pct ?? null,
      temp_c: r.temp_c ?? null,
    }));
    await db()`INSERT INTO sensor_readings ${db()(rows)}`;
  }
  return Response.json(await evaluateDamp(propertyId));
});

/** Hourly series for charts: ?propertyId=…&days=14 */
export const GET = handle(async (req: Request) => {
  await connection();
  const url = new URL(req.url);
  const propertyId = z.string().uuid().parse(url.searchParams.get("propertyId"));
  const days = Number(url.searchParams.get("days") ?? 14);
  const now = await getNow();
  const series = await db()`
    SELECT room, bucket, avg_rh, max_rh, avg_temp, min_temp FROM sensor_hourly
    WHERE property_id = ${propertyId} AND bucket > ${now}::timestamptz - make_interval(days => ${days})
    ORDER BY bucket`;
  return Response.json({ series });
});
