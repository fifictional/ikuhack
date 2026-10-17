import { z } from "zod";
import { db } from "@/lib/db/client";
import { getNow } from "@/lib/db/settings";
import { handle } from "@/lib/http";
import { anchorSoon } from "@/lib/solana/anchor";

/** The landlord has given the tenant their copy. Stamps the latest record and anchors the timestamp. */
export const POST = handle(async (req: Request) => {
  const { propertyId, kind } = z
    .object({ propertyId: z.uuid(), kind: z.enum(["gas_safety", "eicr"]) })
    .parse(await req.json());
  const [row] = await db()`
    UPDATE compliance_records SET copy_sent_at = ${await getNow()}
    WHERE id = (SELECT id FROM compliance_records WHERE property_id = ${propertyId} AND kind = ${kind}
                ORDER BY performed_at DESC LIMIT 1) AND copy_sent_at IS NULL
    RETURNING id`;
  if (!row) return Response.json({ error: "no_open_record" }, { status: 404 });
  anchorSoon();
  return Response.json({ id: row.id });
});
