-- Law freshness check. One row per source per run; history is kept so "when did we
-- first flag this source" stays answerable. status: current | amended | manual.
CREATE TABLE IF NOT EXISTS law_source_checks (
  source_id text NOT NULL,
  checked_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('current', 'amended', 'manual')),
  modified_on text,
  note text,
  PRIMARY KEY (source_id, checked_at)
);
