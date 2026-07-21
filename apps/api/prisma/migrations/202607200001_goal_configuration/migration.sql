CREATE TYPE "AdjustmentSource" AS ENUM ('manual_calories', 'estimated_weight_rate');

DROP TABLE IF EXISTS "goal_targets";

CREATE TABLE "goal_configurations" (
    "user_id" UUID NOT NULL,
    "goal_mode" "GoalMode" NOT NULL,
    "daily_energy_adjustment" INTEGER NOT NULL,
    "adjustment_source" "AdjustmentSource" NOT NULL,
    "desired_weekly_weight_change" DECIMAL(4, 2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "goal_configurations_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "goal_configurations_adjustment_direction_check"
      CHECK (
        ("goal_mode" = 'cut' AND "daily_energy_adjustment" < 0)
        OR ("goal_mode" = 'maintain' AND "daily_energy_adjustment" = 0)
        OR ("goal_mode" = 'bulk' AND "daily_energy_adjustment" > 0)
      ),
    CONSTRAINT "goal_configurations_temporary_adjustment_boundary_check"
      CHECK ("daily_energy_adjustment" BETWEEN -2000 AND 2000),
    CONSTRAINT "goal_configurations_estimated_rate_requires_weight_change_check"
      CHECK (
        "adjustment_source" <> 'estimated_weight_rate'
        OR "desired_weekly_weight_change" IS NOT NULL
      ),
    CONSTRAINT "goal_configurations_weight_change_positive_check"
      CHECK (
        "desired_weekly_weight_change" IS NULL
        OR "desired_weekly_weight_change" > 0
      ),
    CONSTRAINT "goal_configurations_maintain_not_estimated_rate_check"
      CHECK (
        "goal_mode" <> 'maintain'
        OR "adjustment_source" <> 'estimated_weight_rate'
      ),
    CONSTRAINT "goal_configurations_manual_calories_has_adjustment_check"
      CHECK (
        "adjustment_source" <> 'manual_calories'
        OR "daily_energy_adjustment" IS NOT NULL
      )
);

ALTER TABLE "goal_configurations"
  ADD CONSTRAINT "goal_configurations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
