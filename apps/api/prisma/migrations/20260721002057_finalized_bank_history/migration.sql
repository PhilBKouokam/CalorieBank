-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('daily_finalization', 'adjustment');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('finalized_daily_bank_record', 'manual_adjustment');

-- CreateTable
CREATE TABLE "finalized_daily_bank_records" (
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
    "finalized_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finalized_daily_bank_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calorie_ledger_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "amount_calories" INTEGER NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calorie_ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finalized_daily_bank_records_user_id_log_date_idx" ON "finalized_daily_bank_records"("user_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "finalized_daily_bank_records_user_id_log_date_key" ON "finalized_daily_bank_records"("user_id", "log_date");

-- CreateIndex
CREATE INDEX "calorie_ledger_transactions_user_id_log_date_idx" ON "calorie_ledger_transactions"("user_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "calorie_ledger_transactions_user_id_idempotency_key_key" ON "calorie_ledger_transactions"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "finalized_daily_bank_records" ADD CONSTRAINT "finalized_daily_bank_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calorie_ledger_transactions" ADD CONSTRAINT "calorie_ledger_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calorie_ledger_transactions" ADD CONSTRAINT "calorie_ledger_transactions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "finalized_daily_bank_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
