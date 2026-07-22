ALTER TABLE "finalized_daily_bank_records"
  ADD COLUMN "locked_by_sync_session_id" UUID;

CREATE INDEX "finalized_daily_bank_records_locked_sync_session_idx"
  ON "finalized_daily_bank_records"("locked_by_sync_session_id");

ALTER TABLE "finalized_daily_bank_records"
  ADD CONSTRAINT "finalized_daily_bank_records_locked_sync_session_fkey"
    FOREIGN KEY ("locked_by_sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
