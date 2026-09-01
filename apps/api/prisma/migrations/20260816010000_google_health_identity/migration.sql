ALTER TABLE "google_health_connections"
ADD COLUMN "health_user_id" TEXT,
ADD COLUMN "legacy_user_id" TEXT;

CREATE INDEX "google_health_connections_health_user_id_idx"
ON "google_health_connections"("health_user_id");
