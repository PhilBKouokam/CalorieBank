ALTER TABLE "user_profiles"
ADD COLUMN "daily_bank_target_calories" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "daily_bank_target_chosen_at" TIMESTAMPTZ;

ALTER TABLE "user_profiles" ADD CONSTRAINT "daily_bank_target_nonnegative"
CHECK ("daily_bank_target_calories" BETWEEN 0 AND 2000);
