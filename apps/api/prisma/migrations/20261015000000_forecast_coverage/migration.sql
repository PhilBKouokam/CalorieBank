-- Legacy fetch timestamps are deliberately NOT backfilled as verified coverage.
ALTER TABLE "daily_expenditure_aggregates" ADD COLUMN "retrieved_at" TIMESTAMPTZ, ADD COLUMN "forecast_coverage_at" TIMESTAMPTZ;
