-- Activity context remains current-day awareness data and is intentionally isolated from the ledger.
CREATE TYPE "WorkoutActivityType" AS ENUM (
  'walking', 'running', 'cycling', 'dance', 'strength', 'hiit',
  'swimming', 'yoga', 'elliptical', 'rowing', 'stair', 'other'
);

CREATE TYPE "IngestionSyncSessionStatus" AS ENUM (
  'started', 'partially_completed', 'completed', 'failed'
);

CREATE TYPE "IngestionSyncTrigger" AS ENUM (
  'connection', 'screen_focus', 'app_foreground', 'manual_refresh'
);

CREATE TYPE "IngestionCategoryStatus" AS ENUM (
  'not_attempted', 'ready', 'unavailable', 'error', 'skipped'
);

CREATE TABLE "dashboard_preferences" (
  "user_id" UUID NOT NULL,
  "show_latest_finalized_contribution" BOOLEAN NOT NULL DEFAULT true,
  "show_today_so_far" BOOLEAN NOT NULL DEFAULT true,
  "show_planned_treat" BOOLEAN NOT NULL DEFAULT true,
  "show_steps" BOOLEAN NOT NULL DEFAULT true,
  "show_workouts" BOOLEAN NOT NULL DEFAULT true,
  "show_current_goal" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "dashboard_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "ingestion_sync_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "trigger" "IngestionSyncTrigger" NOT NULL,
  "status" "IngestionSyncSessionStatus" NOT NULL DEFAULT 'started',
  "started_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,
  "app_version" TEXT,
  "provider_adapter_version" TEXT,
  "expenditure_status" "IngestionCategoryStatus" NOT NULL DEFAULT 'not_attempted',
  "intake_status" "IngestionCategoryStatus" NOT NULL DEFAULT 'not_attempted',
  "steps_status" "IngestionCategoryStatus" NOT NULL DEFAULT 'not_attempted',
  "workouts_status" "IngestionCategoryStatus" NOT NULL DEFAULT 'not_attempted',
  "records_imported" INTEGER NOT NULL DEFAULT 0,
  "records_updated" INTEGER NOT NULL DEFAULT 0,
  "records_skipped" INTEGER NOT NULL DEFAULT 0,
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingestion_sync_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingestion_sync_session_counts_nonnegative_check" CHECK (
    "records_imported" >= 0 AND "records_updated" >= 0
    AND "records_skipped" >= 0 AND "warning_count" >= 0
  )
);

CREATE TABLE "daily_step_aggregates" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_record_id" TEXT NOT NULL,
  "total_steps" INTEGER NOT NULL,
  "imported_at" TIMESTAMPTZ NOT NULL,
  "provider_updated_at" TIMESTAMPTZ,
  "sync_status" "AggregateSyncStatus" NOT NULL,
  "is_current_day" BOOLEAN NOT NULL,
  "sync_session_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "daily_step_aggregates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_step_aggregates_total_nonnegative_check" CHECK ("total_steps" >= 0)
);

CREATE TABLE "current_day_workouts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_workout_id" TEXT NOT NULL,
  "activity_type" "WorkoutActivityType" NOT NULL,
  "display_name" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL,
  "ended_at" TIMESTAMPTZ NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "total_energy_burned" INTEGER,
  "total_distance" DECIMAL(12,2),
  "distance_unit" TEXT,
  "imported_at" TIMESTAMPTZ NOT NULL,
  "provider_updated_at" TIMESTAMPTZ,
  "sync_status" "AggregateSyncStatus" NOT NULL,
  "is_current_day" BOOLEAN NOT NULL,
  "sync_session_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "current_day_workouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "current_day_workouts_time_check" CHECK ("ended_at" > "started_at"),
  CONSTRAINT "current_day_workouts_duration_check" CHECK ("duration_minutes" > 0),
  CONSTRAINT "current_day_workouts_energy_check" CHECK (
    "total_energy_burned" IS NULL OR "total_energy_burned" >= 0
  ),
  CONSTRAINT "current_day_workouts_distance_check" CHECK (
    "total_distance" IS NULL OR "total_distance" >= 0
  )
);

ALTER TABLE "daily_expenditure_aggregates" ADD COLUMN "sync_session_id" UUID;
ALTER TABLE "daily_intake_aggregates" ADD COLUMN "sync_session_id" UUID;

CREATE UNIQUE INDEX "daily_step_aggregates_user_id_provider_provider_record_id_key"
  ON "daily_step_aggregates"("user_id", "provider", "provider_record_id");
CREATE UNIQUE INDEX "daily_step_aggregates_user_id_local_date_provider_key"
  ON "daily_step_aggregates"("user_id", "local_date", "provider");
CREATE INDEX "daily_step_aggregates_user_id_local_date_idx"
  ON "daily_step_aggregates"("user_id", "local_date");
CREATE UNIQUE INDEX "current_day_workouts_user_id_provider_provider_workout_id_key"
  ON "current_day_workouts"("user_id", "provider", "provider_workout_id");
CREATE INDEX "current_day_workouts_user_id_local_date_provider_idx"
  ON "current_day_workouts"("user_id", "local_date", "provider");
CREATE INDEX "ingestion_sync_sessions_user_id_local_date_provider_idx"
  ON "ingestion_sync_sessions"("user_id", "local_date", "provider");

ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_sync_sessions" ADD CONSTRAINT "ingestion_sync_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_step_aggregates" ADD CONSTRAINT "daily_step_aggregates_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "current_day_workouts" ADD CONSTRAINT "current_day_workouts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_expenditure_aggregates" ADD CONSTRAINT "daily_expenditure_aggregates_sync_session_id_fkey"
  FOREIGN KEY ("sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_intake_aggregates" ADD CONSTRAINT "daily_intake_aggregates_sync_session_id_fkey"
  FOREIGN KEY ("sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_step_aggregates" ADD CONSTRAINT "daily_step_aggregates_sync_session_id_fkey"
  FOREIGN KEY ("sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "current_day_workouts" ADD CONSTRAINT "current_day_workouts_sync_session_id_fkey"
  FOREIGN KEY ("sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
