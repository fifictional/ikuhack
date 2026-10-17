/**
 * Fixed ids for seeded demo personas. There is no real auth in the hackathon
 * build — the tenant and landlord views are scoped to these ids.
 * TODO(stretch): replace with real sign-in (magic link) before any real users.
 */
export const DEMO = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  landlordId: "22222222-2222-4222-8222-222222222222",
  contractorId: "33333333-3333-4333-8333-333333333333",
  tenantPropertyId: "44444444-4444-4444-8444-444444444444",
} as const;
