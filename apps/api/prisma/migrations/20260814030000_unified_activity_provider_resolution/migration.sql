ALTER TABLE "provider_selections"
ADD COLUMN "authoritative_activity_provider" TEXT NOT NULL DEFAULT 'apple_health',
ADD COLUMN "allow_activity_fallback" BOOLEAN NOT NULL DEFAULT false;

UPDATE "provider_selections"
SET "authoritative_activity_provider" = "authoritative_expenditure_provider"
WHERE "authoritative_expenditure_provider" = 'google_health_fitbit';

ALTER TABLE "ingestion_sync_sessions"
ADD COLUMN "category_results" JSONB NOT NULL DEFAULT '[]'::jsonb;
