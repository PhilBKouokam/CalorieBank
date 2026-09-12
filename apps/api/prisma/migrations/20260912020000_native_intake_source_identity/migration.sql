ALTER TABLE "provider_selections" ADD COLUMN "native_intake_source_id" TEXT;
ALTER TABLE "daily_intake_aggregates" ADD COLUMN "source_id" TEXT NOT NULL DEFAULT '', ADD COLUMN "source_display_name" TEXT;
DROP INDEX "daily_intake_aggregates_user_id_local_date_provider_key";
CREATE UNIQUE INDEX "daily_intake_aggregates_user_id_local_date_provider_source_id_key" ON "daily_intake_aggregates"("user_id", "local_date", "provider", "source_id");
ALTER TABLE "historical_source_authority_overrides" ADD COLUMN "intake_source_id" TEXT;
ALTER TABLE "bank_calculation_snapshots" ADD COLUMN "intake_source_id" TEXT;
ALTER TABLE "ingestion_sync_sessions" ADD COLUMN "source_id" TEXT;

ALTER TABLE "daily_intake_aggregates" ADD COLUMN "evidence_observed_at" TIMESTAMPTZ;
