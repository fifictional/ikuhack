/**
 * Ids of the seeded sample tenant and landlord accounts. Sign-in currently selects one of these
 * (see src/lib/session.ts); swapping in real accounts (e.g. magic-link sign-in) replaces this file.
 */
export const DEMO = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  landlordId: "22222222-2222-4222-8222-222222222222",
  contractorId: "33333333-3333-4333-8333-333333333333",
  tenantPropertyId: "44444444-4444-4444-8444-444444444444",
} as const;
