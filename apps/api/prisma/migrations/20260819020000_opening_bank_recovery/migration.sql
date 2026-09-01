CREATE TYPE "BankAccountInitializationStatus" AS ENUM (
  'WAITING_FOR_OPENING_DATA',
  'INITIALIZED'
);

CREATE TABLE "bank_account_initializations" (
  "user_id" UUID NOT NULL,
  "status" "BankAccountInitializationStatus" NOT NULL DEFAULT 'WAITING_FOR_OPENING_DATA',
  "historical_opening_net_calories" INTEGER,
  "opening_effective_balance_calories" INTEGER,
  "eligible_day_count" INTEGER NOT NULL DEFAULT 0,
  "lookback_start_date" DATE,
  "lookback_end_date" DATE,
  "accounting_starts_on" DATE,
  "timezone" TEXT,
  "initialized_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_account_initializations_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "bank_account_initializations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "opening_bank_calculation_days" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "log_date" DATE NOT NULL,
  "timezone" TEXT NOT NULL,
  "imported_total_daily_expenditure" INTEGER NOT NULL,
  "expenditure_adjustment_rate" DECIMAL(4,2) NOT NULL,
  "adjusted_expenditure" INTEGER NOT NULL,
  "goal_mode" "GoalMode" NOT NULL,
  "goal_adjustment_calories" INTEGER NOT NULL,
  "imported_calorie_intake" INTEGER NOT NULL,
  "daily_allowance" INTEGER NOT NULL,
  "daily_bank_change" INTEGER NOT NULL,
  "expenditure_provider" TEXT NOT NULL,
  "expenditure_provider_record_id" TEXT NOT NULL,
  "intake_provider" TEXT NOT NULL,
  "intake_provider_record_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opening_bank_calculation_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "opening_bank_calculation_days_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "bank_account_initializations"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "opening_bank_calculation_days_user_id_log_date_key"
  ON "opening_bank_calculation_days"("user_id", "log_date");
CREATE INDEX "opening_bank_calculation_days_user_id_log_date_idx"
  ON "opening_bank_calculation_days"("user_id", "log_date");

-- Accounts that predate this policy retain their exact ledger history and are not floored retroactively.
INSERT INTO "bank_account_initializations" (
  "user_id",
  "status",
  "historical_opening_net_calories",
  "opening_effective_balance_calories",
  "eligible_day_count",
  "initialized_at"
)
SELECT
  "id",
  'INITIALIZED'::"BankAccountInitializationStatus",
  0,
  0,
  0,
  CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT ("user_id") DO NOTHING;
