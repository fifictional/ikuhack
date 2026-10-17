import { z } from "zod";
import { db } from "@/lib/db/client";
import { getNow } from "@/lib/db/settings";
import { sha256Hex } from "@/lib/evidence/hash";
import { handle } from "@/lib/http";
import { anchorSoon } from "@/lib/solana/anchor";

const MAX_CERT_BYTES = 8 * 1024 * 1024;

/** Landlord records an inspection (optionally with the certificate). The record and certificate are anchored on Solana straight away. */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const input = z
    .object({
      propertyId: z.uuid(),
      kind: z.enum(["gas_safety", "eicr"]),
      performedAt: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  const file = form.get("certificate");
  const cert = file instanceof File && file.size > 0 ? file : null;
  if (cert && cert.size > MAX_CERT_BYTES) return Response.json({ error: "certificate_too_large" }, { status: 413 });
  const bytes = cert ? new Uint8Array(await cert.arrayBuffer()) : null;

  const performedAt = input.performedAt ? new Date(input.performedAt) : await getNow();
  if (Number.isNaN(performedAt.getTime())) return Response.json({ error: "invalid_date" }, { status: 400 });

  const [row] = await db()`
    INSERT INTO compliance_records (property_id, kind, performed_at, certificate, certificate_mime, certificate_name, certificate_sha256)
    VALUES (${input.propertyId}, ${input.kind}, ${performedAt}, ${bytes ? Buffer.from(bytes) : null}, ${cert?.type || null},
            ${cert?.name ?? null}, ${bytes ? sha256Hex(bytes) : null})
    RETURNING id`;
  anchorSoon();
  return Response.json({ id: row.id, certificateSha256: bytes ? sha256Hex(bytes) : null });
});
