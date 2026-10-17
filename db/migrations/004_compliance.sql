-- Recurring statutory compliance records (gas safety, EICR).
-- One row per inspection. The 12-month / 5-year next-due date and the 28-day
-- tenant-copy deadline are derived by src/lib/compliance/duties.ts, not stored.
CREATE TABLE compliance_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id),
  kind         text NOT NULL CHECK (kind IN ('gas_safety', 'eicr')),
  performed_at timestamptz NOT NULL,
  copy_sent_at timestamptz,
  evidence_id  uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON compliance_records (property_id, kind, performed_at DESC);
