import { connection } from "next/server";
import { db } from "@/lib/db/client";

/** The signed-in tenant's home address, for the page header (instead of a hard-coded one). */
export async function tenantHomeAddress(tenantId: string): Promise<string | null> {
  await connection();
  const [row] = await db()<{ address: string }[]>`SELECT address FROM properties WHERE tenant_id = ${tenantId} LIMIT 1`;
  return row?.address ?? null;
}

/** The signed-in landlord's organisation name. */
export async function landlordName(landlordId: string): Promise<string | null> {
  await connection();
  const [row] = await db()<{ name: string }[]>`SELECT name FROM parties WHERE id = ${landlordId}`;
  return row?.name ?? null;
}
