CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_daily_log_hash
  ON attachments(daily_log_id, file_hash)
  WHERE daily_log_id IS NOT NULL AND file_hash IS NOT NULL;
