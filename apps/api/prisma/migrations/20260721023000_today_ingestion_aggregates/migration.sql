-- CreateEnum
CREATE TYPE "AggregateSyncStatus" AS ENUM (
  'unavailable',
  'not_connected',
  'syncing',
  'partial',
  'stale',
  'ready',
  'error'
);

-- CreateTable
CREATE TABLE "daily_expenditure_aggregates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_record_id" TEXT NOT NULL,
  "raw_total_daily_expenditure" INTEGER NOT NULL,
  "adjusted_daily_expenditure" INTEGER NOT NULL,
  "adjustment_factor" DECIMAL(4,2) NOT NULL,
  "imported_at" TIMESTAMPTZ NOT NULL,
  "provider_updated_at" TIMESTAMPTZ,
  "sync_status" "AggregateSyncStatus" NOT NULL,
  "is_current_day" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "daily_expenditure_aggregates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_expenditure_aggregates_raw_total_nonnegative_check" CHECK ("raw_total_daily_expenditure" >= 0),
  CONSTRAINT "daily_expenditure_aggregates_adjusted_nonnegative_check" CHECK ("adjusted_daily_expenditure" >= 0),
  CONSTRAINT "daily_expenditure_aggregates_adjustment_factor_check" CHECK ("adjustment_factor" >= 0 AND "adjustment_factor" <= 1)
);

-- CreateTable
CREATE TABLE "daily_intake_aggregates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_record_id" TEXT NOT NULL,
  "total_calories_consumed" INTEGER NOT NULL,
  "imported_at" TIMESTAMPTZ NOT NULL,
  "provider_updated_at" TIMESTAMPTZ,
  "sync_status" "AggregateSyncStatus" NOT NULL,
  "is_current_day" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "daily_intake_aggregates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_intake_aggregates_total_nonnegative_check" CHECK ("total_calories_consumed" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_expenditure_aggregates_user_id_provider_provider_record_id_key"
  ON "daily_expenditure_aggregates"("user_id", "provider", "provider_record_id");

-- CreateIndex
CREATE INDEX "daily_expenditure_aggregates_user_id_local_date_idx"
  ON "daily_expenditure_aggregates"("user_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_intake_aggregates_user_id_provider_provider_record_id_key"
  ON "daily_intake_aggregates"("user_id", "provider", "provider_record_id");

-- CreateIndex
CREATE INDEX "daily_intake_aggregates_user_id_local_date_idx"
  ON "daily_intake_aggregates"("user_id", "local_date");

-- AddForeignKey
ALTER TABLE "daily_expenditure_aggregates"
  ADD CONSTRAINT "daily_expenditure_aggregates_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_intake_aggregates"
  ADD CONSTRAINT "daily_intake_aggregates_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
