ALTER TABLE "provider_selections"
  ADD COLUMN "apple_health_intake_writer_bundle_id" TEXT,
  ADD COLUMN "apple_health_intake_writer_display_name" TEXT;

ALTER TABLE "daily_intake_aggregates"
  ADD COLUMN "writer_bundle_identifier" TEXT,
  ADD COLUMN "writer_display_name" TEXT;

ALTER TABLE "bank_calculation_snapshots"
  ADD COLUMN "intake_source_display_name" TEXT;

ALTER TABLE "opening_bank_calculation_days"
  ADD COLUMN "intake_source_display_name" TEXT;
