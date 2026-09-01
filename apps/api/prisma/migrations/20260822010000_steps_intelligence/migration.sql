CREATE TYPE "DashboardPreferenceDecisionSource" AS ENUM ('unset', 'inferred', 'explicit');

ALTER TABLE "current_day_workouts"
ADD COLUMN "total_steps" INTEGER;

ALTER TABLE "dashboard_preferences"
ADD COLUMN "steps_visibility_source" "DashboardPreferenceDecisionSource" NOT NULL DEFAULT 'unset';

-- Every existing row represents a preference already presented to the user. Preserve it.
UPDATE "dashboard_preferences"
SET "steps_visibility_source" = 'explicit';
