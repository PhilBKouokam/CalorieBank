ALTER TABLE "calorie_ledger_transactions"
  DROP CONSTRAINT "calorie_ledger_transactions_snapshot_fkey";

ALTER TABLE "calorie_ledger_transactions"
  ADD CONSTRAINT "calorie_ledger_transactions_snapshot_fkey"
    FOREIGN KEY ("calculation_snapshot_id") REFERENCES "bank_calculation_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
