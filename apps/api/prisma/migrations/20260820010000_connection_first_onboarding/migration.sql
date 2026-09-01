ALTER TABLE "user_profiles"
ADD COLUMN "onboarding_welcome_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onboarding_completed_at" TIMESTAMPTZ;

-- Existing accounts retain their established journey and are never forced through new-user onboarding.
UPDATE "user_profiles"
SET
  "onboarding_welcome_completed" = true,
  "onboarding_completed_at" = CURRENT_TIMESTAMP;

ALTER TABLE "dashboard_preferences"
ALTER COLUMN "show_planned_treat" SET DEFAULT false,
ALTER COLUMN "show_steps" SET DEFAULT false,
ALTER COLUMN "show_workouts" SET DEFAULT false,
ALTER COLUMN "show_current_goal" SET DEFAULT false;
