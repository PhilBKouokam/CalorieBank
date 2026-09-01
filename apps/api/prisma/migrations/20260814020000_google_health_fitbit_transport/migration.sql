-- Replace the pre-QA legacy Fitbit OAuth transport with Google Health OAuth.
ALTER TABLE "fitbit_connections" RENAME TO "google_health_connections";
ALTER TABLE "fitbit_oauth_attempts" RENAME TO "google_health_oauth_attempts";

ALTER TABLE "google_health_connections" DROP COLUMN "fitbit_user_id";
ALTER TABLE "google_health_connections" ADD COLUMN "refresh_token_expires_at" TIMESTAMPTZ;

ALTER INDEX "fitbit_connections_status_idx" RENAME TO "google_health_connections_status_idx";
ALTER INDEX "fitbit_oauth_attempts_state_hash_key" RENAME TO "google_health_oauth_attempts_state_hash_key";
ALTER INDEX "fitbit_oauth_attempts_user_id_expires_at_idx" RENAME TO "google_health_oauth_attempts_user_id_expires_at_idx";

ALTER TABLE "google_health_connections" RENAME CONSTRAINT "fitbit_connections_pkey" TO "google_health_connections_pkey";
ALTER TABLE "google_health_oauth_attempts" RENAME CONSTRAINT "fitbit_oauth_attempts_pkey" TO "google_health_oauth_attempts_pkey";
ALTER TABLE "google_health_connections" RENAME CONSTRAINT "fitbit_connections_user_id_fkey" TO "google_health_connections_user_id_fkey";
ALTER TABLE "google_health_oauth_attempts" RENAME CONSTRAINT "fitbit_oauth_attempts_user_id_fkey" TO "google_health_oauth_attempts_user_id_fkey";

-- No legacy connection existed before physical-device Fitbit QA. Selection rows are
-- still migrated defensively; immutable aggregate and calculation provenance is not rewritten.
UPDATE "provider_selections"
SET "authoritative_expenditure_provider" = 'google_health_fitbit'
WHERE "authoritative_expenditure_provider" = 'fitbit';
