CREATE TABLE "resting_burn_estimates" (
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_kcal_per_hour" DOUBLE PRECISION NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "observation_count" INTEGER NOT NULL,
    "lookback_start_date" DATE NOT NULL,
    "lookback_end_date" DATE NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "resting_burn_estimates_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "resting_burn_estimates_provider_calculated_at_idx"
ON "resting_burn_estimates"("provider", "calculated_at");

ALTER TABLE "resting_burn_estimates"
ADD CONSTRAINT "resting_burn_estimates_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
