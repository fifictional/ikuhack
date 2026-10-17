-- Landlord-triggered authenticity checks on photos. Kept outside the case log: a check is advice
-- about a file, not a legal fact, so it never feeds the engine.
CREATE TABLE evidence_checks (
  evidence_id uuid PRIMARY KEY REFERENCES evidence(id),
  sha256      text NOT NULL,
  result      jsonb NOT NULL,
  checked_at  timestamptz NOT NULL DEFAULT now()
);
