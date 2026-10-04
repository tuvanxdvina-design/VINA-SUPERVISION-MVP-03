BEGIN;

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS workforce_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS machine_details jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_workforce_details_array;
ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_workforce_details_array
  CHECK (jsonb_typeof(workforce_details) = 'array');
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_machine_details_array;
ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_machine_details_array
  CHECK (jsonb_typeof(machine_details) = 'array');

COMMIT;
