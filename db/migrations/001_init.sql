-- Docket schema. Runs on Tiger Data (Tiger Cloud) or local TimescaleDB (docker compose).
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE parties (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role               text NOT NULL CHECK (role IN ('tenant', 'landlord', 'contractor', 'surveyor')),
  name               text NOT NULL,
  email              text,
  phone              text,
  preferred_language text NOT NULL DEFAULT 'en',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address       text NOT NULL,
  postcode      text NOT NULL,
  landlord_type text NOT NULL CHECK (landlord_type IN ('social', 'private')),
  landlord_id   uuid NOT NULL REFERENCES parties(id),
  tenant_id     uuid REFERENCES parties(id),
  -- Parsed tenancy agreement terms (appliances supplied, start date, ...).
  tenancy       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  title       text NOT NULL,
  opened_at   timestamptz NOT NULL,
  -- Latest engine projection (cache; always recomputable from case_events).
  state       jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON cases (property_id);

-- Append-only event log. Hash-chained per case so neither party can rewrite history.
CREATE TABLE case_events (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  case_id     uuid NOT NULL REFERENCES cases(id),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  prev_hash   text,
  hash        text NOT NULL,
  PRIMARY KEY (id, occurred_at)
);
SELECT create_hypertable('case_events', by_range('occurred_at', INTERVAL '7 days'));
CREATE INDEX ON case_events (case_id, seq);

-- What the agent concluded and when it changed its mind (time-travel audit).
CREATE TABLE case_revisions (
  case_id     uuid NOT NULL,
  at          timestamptz NOT NULL,
  kind        text NOT NULL,
  summary     text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}'
);
SELECT create_hypertable('case_revisions', by_range('at', INTERVAL '7 days'));
CREATE INDEX ON case_revisions (case_id, at DESC);

-- Files are stored in Postgres for the hackathon (one less service). Fine for demo-sized photos.
CREATE TABLE evidence (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id),
  kind        text NOT NULL,
  mime        text NOT NULL,
  filename    text,
  caption     text,
  sha256      text NOT NULL,
  bytes       bytea NOT NULL,
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON evidence (sha256);

-- Solana anchoring: one Merkle root per batch of evidence hashes + case-log heads.
CREATE TABLE anchors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merkle_root  text NOT NULL,
  leaf_count   int NOT NULL,
  cluster      text NOT NULL,
  tx_signature text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE anchor_leaves (
  anchor_id uuid NOT NULL REFERENCES anchors(id),
  leaf      text NOT NULL,
  leaf_kind text NOT NULL CHECK (leaf_kind IN ('evidence', 'case_head')),
  ref_id    uuid NOT NULL,
  proof     jsonb NOT NULL
);
CREATE INDEX ON anchor_leaves (leaf);

-- IoT sensor stream (simulated for the demo).
CREATE TABLE sensor_readings (
  property_id  uuid NOT NULL,
  room         text NOT NULL,
  ts           timestamptz NOT NULL,
  humidity_pct double precision,
  temp_c       double precision
);
SELECT create_hypertable('sensor_readings', by_range('ts', INTERVAL '1 day'));
CREATE INDEX ON sensor_readings (property_id, ts DESC);

CREATE MATERIALIZED VIEW sensor_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT property_id,
       room,
       time_bucket('1 hour', ts) AS bucket,
       avg(humidity_pct) AS avg_rh,
       max(humidity_pct) AS max_rh,
       avg(temp_c)       AS avg_temp,
       min(temp_c)       AS min_temp
FROM sensor_readings
GROUP BY property_id, room, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('sensor_hourly',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes');

-- Demo controls (clock offset, law overrides).
CREATE TABLE app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
