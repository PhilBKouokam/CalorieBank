ALTER TABLE "daily_expenditure_aggregates"
  ADD COLUMN "active_energy_calories" INTEGER,
  ADD COLUMN "basal_energy_calories" INTEGER;

CREATE UNIQUE INDEX "daily_expenditure_aggregates_user_date_provider_key"
  ON "daily_expenditure_aggregates"("user_id", "local_date", "provider");

CREATE UNIQUE INDEX "daily_intake_aggregates_user_date_provider_key"
  ON "daily_intake_aggregates"("user_id", "local_date", "provider");

ALTER TABLE "daily_expenditure_aggregates"
  ADD CONSTRAINT "daily_expenditure_components_nonnegative_check"
  CHECK (
    ("active_energy_calories" IS NULL OR "active_energy_calories" >= 0)
    AND ("basal_energy_calories" IS NULL OR "basal_energy_calories" >= 0)
  ),
  ADD CONSTRAINT "daily_expenditure_components_total_check"
  CHECK (
    "active_energy_calories" IS NULL
    OR "basal_energy_calories" IS NULL
    OR "active_energy_calories" + "basal_energy_calories" = "raw_total_daily_expenditure"
  );
