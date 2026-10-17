-- Cache generated speech so replaying the same update never costs ElevenLabs credits twice.
CREATE TABLE tts_cache (
  key        text PRIMARY KEY,          -- sha256(voice | model | text)
  audio      bytea NOT NULL,
  chars      int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
