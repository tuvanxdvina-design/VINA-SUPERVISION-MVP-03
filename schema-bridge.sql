CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS mvp_records (
  entity_type varchar(50) NOT NULL,
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_mvp_records_type_updated ON mvp_records(entity_type, updated_at DESC);
