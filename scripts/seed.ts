import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db/client";
import { appendEvent, createCase } from "@/lib/cases/service";
import { DEMO } from "@/lib/demo";
import type { EventBody } from "@/lib/domain/types";

/**
 * Seeds the demo world: one housing association, the hero tenant's flat, and a
 * handful of historical cases so the landlord dashboard isn't empty.
 * Safe to re-run: wipes demo data first.
 */
const daysAgo = (d: number, h = 9) => new Date(Date.now() - d * 86_400_000 + (h - 9) * 3_600_000);
const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d;
};

const fact = (key: string, value: unknown, kind: string, label?: string) =>
  ({ type: "FACT_ASSERTED", key, value, source: { kind, label } }) as EventBody;

async function main() {
  const sql = db();
  await sql`TRUNCATE anchor_leaves, anchors, evidence, compliance_records, case_revisions, case_events, cases, properties, parties, app_settings, sensor_readings CASCADE`;

  await sql`INSERT INTO parties (id, role, name, email, preferred_language) VALUES
    (${DEMO.tenantId}, 'tenant', 'Amira Haddad', 'amira@example.test', 'en'),
    (${DEMO.landlordId}, 'landlord', 'Riverside Homes Housing Association', 'repairs@riverside.example.test', 'en'),
    (${DEMO.contractorId}, 'contractor', 'AquaFix Ltd', 'jobs@aquafix.example.test', 'en')`;

  await sql`INSERT INTO properties (id, address, postcode, landlord_type, landlord_id, tenant_id, tenancy) VALUES
    (${DEMO.tenantPropertyId}, 'Flat 4, 12 Canal Street, London', 'E3 2AB', 'social', ${DEMO.landlordId}, ${DEMO.tenantId},
     ${sql.json({ appliancesSuppliedByLandlord: ["dishwasher", "oven", "fridge"], start: "2024-03-01" })})`;

  // Other homes in the landlord's portfolio (tenants are placeholders).
  const others = [];
  for (const [i, addr] of ["Flat 1, 12 Canal Street", "Flat 7, 12 Canal Street", "3 Lock Row", "18 Wharf Lane"].entries()) {
    const [t] = await sql`INSERT INTO parties (role, name) VALUES ('tenant', ${`Tenant ${i + 1}`}) RETURNING id`;
    const [p] = await sql`INSERT INTO properties (address, postcode, landlord_type, landlord_id, tenant_id)
      VALUES (${addr + ", London"}, 'E3 2AB', 'social', ${DEMO.landlordId}, ${t.id}) RETURNING id`;
    others.push(p.id as string);
  }

  // Recurring compliance: a mix of healthy, due and breached records.
  await sql`INSERT INTO compliance_records (property_id, kind, performed_at, copy_sent_at) VALUES
    (${DEMO.tenantPropertyId}, 'gas_safety', ${monthsAgo(11)}, ${monthsAgo(11)}),
    (${DEMO.tenantPropertyId}, 'eicr', ${monthsAgo(50)}, ${monthsAgo(50)}),
    (${others[0]}, 'gas_safety', ${monthsAgo(13)}, NULL),
    (${others[0]}, 'eicr', ${monthsAgo(61)}, ${monthsAgo(61)}),
    (${others[1]}, 'gas_safety', ${monthsAgo(5)}, ${monthsAgo(5)}),
    (${others[1]}, 'eicr', ${monthsAgo(54)}, NULL),
    (${others[2]}, 'eicr', ${monthsAgo(20)}, ${monthsAgo(20)}),
    (${others[3]}, 'gas_safety', ${monthsAgo(2)}, NULL),
    (${others[3]}, 'eicr', ${monthsAgo(59)}, ${monthsAgo(59)})`;

  // Historical cases: one resolved on time, one breached, one awaiting access.
  const resolved = await createCase({
    propertyId: others[0],
    title: "Bathroom extractor fan broken",
    report: { description: "Extractor fan in bathroom not working", channel: "text" },
    facts: [fact("issue.category", "electrical", "tenant"), fact("issue.severity", "routine", "tenant")],
    at: daysAgo(30),
  });
  await appendEvent(resolved.caseId, "landlord", { type: "ACKNOWLEDGED" }, daysAgo(30, 11));
  await appendEvent(resolved.caseId, "contractor", { type: "WORKS_COMPLETED", notes: "Fan replaced" }, daysAgo(22));
  await appendEvent(resolved.caseId, "tenant", { type: "TENANT_CONFIRMED_FIXED" }, daysAgo(21));

  await createCase({
    propertyId: others[1],
    title: "No hot water",
    report: { description: "No hot water for two days", channel: "voice" },
    facts: [fact("issue.category", "heating_hot_water", "tenant"), fact("issue.severity", "significant", "surveyor", "Surveyor")],
    at: daysAgo(18),
  });

  const access = await createCase({
    propertyId: others[2],
    title: "Front door lock broken",
    report: { description: "Front door lock does not close", channel: "text" },
    facts: [fact("issue.category", "security", "tenant"), fact("issue.severity", "significant", "tenant")],
    at: daysAgo(3),
  });
  await appendEvent(access.caseId, "landlord", { type: "ACKNOWLEDGED" }, daysAgo(3, 12));
  await appendEvent(access.caseId, "landlord", { type: "ACCESS_PROPOSED", slotStart: daysAgo(-1).toISOString() }, daysAgo(2));

  console.log("seeded demo data");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
