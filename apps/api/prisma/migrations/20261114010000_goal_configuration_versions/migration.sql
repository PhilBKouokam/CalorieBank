-- Append-only goal history. Existing rows are not rewritten.
-- A goal that was never edited covers every earlier date.
-- A goal that was already overwritten is known only from its last write date;
-- earlier dates stay without a version so catch-up does not invent one.

CREATE TABLE "goal_configuration_versions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "goal_mode" "GoalMode" NOT NULL,
    "daily_energy_adjustment" INTEGER NOT NULL,
    "adjustment_source" "AdjustmentSource" NOT NULL,
    "desired_weekly_weight_change" DECIMAL(4,2),
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_configuration_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goal_configuration_versions_user_id_effective_from_recorded_at_idx"
    ON "goal_configuration_versions"("user_id", "effective_from", "recorded_at");

ALTER TABLE "goal_configuration_versions"
    ADD CONSTRAINT "goal_configuration_versions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "goal_configuration_versions" (
    "id",
    "user_id",
    "effective_from",
    "goal_mode",
    "daily_energy_adjustment",
    "adjustment_source",
    "desired_weekly_weight_change",
    "recorded_at",
    "created_at"
)
SELECT
    gen_random_uuid(),
    g."user_id",
    CASE
        WHEN g."created_at" = g."updated_at" THEN DATE '1970-01-01'
        ELSE (g."updated_at" AT TIME ZONE 'UTC')::date
    END,
    g."goal_mode",
    g."daily_energy_adjustment",
    g."adjustment_source",
    g."desired_weekly_weight_change",
    CASE WHEN g."created_at" = g."updated_at" THEN g."created_at" ELSE g."updated_at" END,
    CURRENT_TIMESTAMP
FROM "goal_configurations" g;
