CREATE TYPE "BankContributionStatus" AS ENUM ('OPEN', 'PROVISIONAL', 'LOCKED');
CREATE TYPE "BankCalculationSnapshotReason" AS ENUM ('INITIAL_POSTING', 'PROVIDER_CORRECTION');

ALTER TABLE "finalized_daily_bank_records"
  ADD COLUMN "original_daily_bank_change" INTEGER,
  ADD COLUMN "effective_daily_bank_change" INTEGER,
  ADD COLUMN "status" "BankContributionStatus" NOT NULL DEFAULT 'LOCKED',
  ADD COLUMN "correction_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "current_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lock_at" TIMESTAMPTZ,
  ADD COLUMN "locked_at" TIMESTAMPTZ;

UPDATE "finalized_daily_bank_records"
SET
  "original_daily_bank_change" = "daily_bank_change",
  "effective_daily_bank_change" = "daily_bank_change",
  "lock_at" = (("log_date" + INTERVAL '3 days')::timestamp AT TIME ZONE "timezone"),
  "locked_at" = CURRENT_TIMESTAMP;

ALTER TABLE "finalized_daily_bank_records"
  ALTER COLUMN "original_daily_bank_change" SET NOT NULL,
  ALTER COLUMN "effective_daily_bank_change" SET NOT NULL,
  ALTER COLUMN "lock_at" SET NOT NULL;

ALTER TABLE "finalized_daily_bank_records"
  ADD CONSTRAINT "finalized_daily_bank_records_status_check"
    CHECK ("status" <> 'OPEN'),
  ADD CONSTRAINT "finalized_daily_bank_records_correction_count_check"
    CHECK ("correction_count" >= 0),
  ADD CONSTRAINT "finalized_daily_bank_records_current_version_check"
    CHECK ("current_version" >= 1);

CREATE TABLE "bank_calculation_snapshots" (
  "id" UUID NOT NULL,
  "finalized_daily_bank_record_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" "BankCalculationSnapshotReason" NOT NULL,
  "imported_total_daily_expenditure" INTEGER NOT NULL,
  "expenditure_adjustment_rate" DECIMAL(4,2) NOT NULL,
  "adjusted_expenditure" INTEGER NOT NULL,
  "goal_mode" "GoalMode" NOT NULL,
  "goal_adjustment_calories" INTEGER NOT NULL,
  "imported_calorie_intake" INTEGER NOT NULL,
  "daily_allowance" INTEGER NOT NULL,
  "daily_bank_change" INTEGER NOT NULL,
  "correction_delta" INTEGER NOT NULL,
  "expenditure_provider" TEXT NOT NULL,
  "expenditure_provider_record_id" TEXT NOT NULL,
  "intake_provider" TEXT NOT NULL,
  "intake_provider_record_id" TEXT NOT NULL,
  "trigger_sync_session_id" UUID,
  "input_fingerprint" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_calculation_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_calculation_snapshots_version_check" CHECK ("version" >= 1)
);

INSERT INTO "bank_calculation_snapshots" (
  "id",
  "finalized_daily_bank_record_id",
  "user_id",
  "version",
  "reason",
  "imported_total_daily_expenditure",
  "expenditure_adjustment_rate",
  "adjusted_expenditure",
  "goal_mode",
  "goal_adjustment_calories",
  "imported_calorie_intake",
  "daily_allowance",
  "daily_bank_change",
  "correction_delta",
  "expenditure_provider",
  "expenditure_provider_record_id",
  "intake_provider",
  "intake_provider_record_id",
  "input_fingerprint",
  "created_at"
)
SELECT
  gen_random_uuid(),
  "id",
  "user_id",
  1,
  'INITIAL_POSTING',
  "imported_total_daily_expenditure",
  "expenditure_adjustment_rate",
  "adjusted_expenditure",
  "goal_mode",
  "goal_adjustment_calories",
  "imported_calorie_intake",
  "daily_allowance",
  "daily_bank_change",
  "daily_bank_change",
  'legacy',
  'legacy:' || "id"::text || ':expenditure',
  'legacy',
  'legacy:' || "id"::text || ':intake',
  'legacy:' || "id"::text,
  "created_at"
FROM "finalized_daily_bank_records";

CREATE UNIQUE INDEX "bank_calculation_snapshots_record_version_key"
  ON "bank_calculation_snapshots"("finalized_daily_bank_record_id", "version");
CREATE UNIQUE INDEX "bank_calculation_snapshots_record_fingerprint_key"
  ON "bank_calculation_snapshots"("finalized_daily_bank_record_id", "input_fingerprint");
CREATE INDEX "bank_calculation_snapshots_user_record_idx"
  ON "bank_calculation_snapshots"("user_id", "finalized_daily_bank_record_id");

ALTER TABLE "bank_calculation_snapshots"
  ADD CONSTRAINT "bank_calculation_snapshots_record_fkey"
    FOREIGN KEY ("finalized_daily_bank_record_id") REFERENCES "finalized_daily_bank_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "bank_calculation_snapshots_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "bank_calculation_snapshots_sync_session_fkey"
    FOREIGN KEY ("trigger_sync_session_id") REFERENCES "ingestion_sync_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calorie_ledger_transactions"
  ADD COLUMN "calculation_snapshot_id" UUID;

UPDATE "calorie_ledger_transactions" AS ledger
SET "calculation_snapshot_id" = snapshot."id"
FROM "bank_calculation_snapshots" AS snapshot
WHERE
  ledger."source_id" = snapshot."finalized_daily_bank_record_id"
  AND ledger."type" = 'daily_finalization'
  AND snapshot."version" = 1;

CREATE UNIQUE INDEX "calorie_ledger_transactions_calculation_snapshot_id_key"
  ON "calorie_ledger_transactions"("calculation_snapshot_id");

ALTER TABLE "calorie_ledger_transactions"
  ADD CONSTRAINT "calorie_ledger_transactions_snapshot_fkey"
    FOREIGN KEY ("calculation_snapshot_id") REFERENCES "bank_calculation_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
