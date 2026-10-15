-- Planning metadata only. No inferred backfill from database update timestamps.
ALTER TABLE "daily_expenditure_aggregates"
  ADD COLUMN "active_sample_end_at" TIMESTAMPTZ,
  ADD COLUMN "basal_sample_end_at" TIMESTAMPTZ,
  ADD COLUMN "reported_interval_end_at" TIMESTAMPTZ,
  ADD COLUMN "planning_anchor_at" TIMESTAMPTZ,
  ADD COLUMN "planning_expires_at" TIMESTAMPTZ,
  ADD COLUMN "planning_progress_at" TIMESTAMPTZ,
  ADD COLUMN "planning_anchor_kind" TEXT;
