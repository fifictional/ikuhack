import { db } from "@/lib/db/client";
import { getNow } from "@/lib/db/settings";
import { complianceDuties, type ComplianceDuty, type ComplianceProperty, type ComplianceRecord } from "./duties";

interface PropertyRow {
  id: string;
  address: string;
  postcode: string;
  landlord_type: "social" | "private";
}

interface RecordRow {
  id: string;
  property_id: string;
  kind: "gas_safety" | "eicr";
  performed_at: Date;
  copy_sent_at: Date | null;
}

/** Loads a landlord's portfolio + its compliance records and derives every duty at the demo clock. */
export async function getComplianceDuties(landlordId?: string): Promise<ComplianceDuty[]> {
  const [properties, records, now] = await Promise.all([
    db()<PropertyRow[]>`SELECT id, address, postcode, landlord_type FROM properties
      WHERE (${landlordId ?? null}::uuid IS NULL OR landlord_id = ${landlordId ?? null})
      ORDER BY address`,
    db()<RecordRow[]>`SELECT id, property_id, kind, performed_at, copy_sent_at FROM compliance_records`,
    getNow(),
  ]);

  return complianceDuties(
    properties.map((p): ComplianceProperty => ({
      id: p.id,
      address: p.address,
      postcode: p.postcode,
      landlordType: p.landlord_type,
    })),
    records.map((r): ComplianceRecord => ({
      id: r.id,
      propertyId: r.property_id,
      kind: r.kind,
      performedAt: r.performed_at.toISOString(),
      copySentAt: r.copy_sent_at ? r.copy_sent_at.toISOString() : null,
    })),
    now,
  );
}
