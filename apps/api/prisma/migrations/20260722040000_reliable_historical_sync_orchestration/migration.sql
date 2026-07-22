ALTER TYPE "IngestionSyncTrigger" ADD VALUE IF NOT EXISTS 'provider_reconnect';
ALTER TYPE "IngestionSyncTrigger" ADD VALUE IF NOT EXISTS 'app_launch';
ALTER TYPE "IngestionSyncTrigger" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "IngestionSyncTrigger" ADD VALUE IF NOT EXISTS 'integration_test';

CREATE TYPE "BankDayProcessingStatus" AS ENUM (
  'waiting_for_intake',
  'waiting_for_expenditure',
  'waiting_for_provider',
  'waiting_for_sync',
  'waiting_for_required_inputs',
  'provisional',
  'locked'
);

ALTER TABLE "ingestion_sync_sessions"
  ADD COLUMN "dates_queried" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dates_uploaded" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dates_skipped" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dates_reconciled" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dates_locked" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "waiting_dates" JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN "errors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "duration_ms" INTEGER;

CREATE TABLE "bank_day_processing_states" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "log_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" "BankDayProcessingStatus" NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ NOT NULL,
  "next_retry_at" TIMESTAMPTZ,
  "last_sync_session_id" UUID,
  "last_error_code" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "bank_day_processing_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_day_processing_states_user_id_log_date_key"
  ON "bank_day_processing_states"("user_id", "log_date");
CREATE INDEX "bank_day_processing_states_status_next_retry_at_idx"
  ON "bank_day_processing_states"("status", "next_retry_at");

ALTER TABLE "bank_day_processing_states"
  ADD CONSTRAINT "bank_day_processing_states_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_day_processing_states"
  ADD CONSTRAINT "bank_day_processing_states_last_sync_session_id_fkey"
  FOREIGN KEY ("last_sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
