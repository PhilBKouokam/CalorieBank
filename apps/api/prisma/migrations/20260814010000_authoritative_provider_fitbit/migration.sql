CREATE TABLE "provider_selections" (
    "user_id" UUID NOT NULL,
    "authoritative_expenditure_provider" TEXT NOT NULL DEFAULT 'apple_health',
    "authoritative_intake_provider" TEXT NOT NULL DEFAULT 'apple_health',
    "allow_expenditure_fallback" BOOLEAN NOT NULL DEFAULT false,
    "selected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "provider_selections_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "fitbit_connections" (
    "user_id" UUID NOT NULL,
    "fitbit_user_id" TEXT NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_refreshed_at" TIMESTAMPTZ,
    "last_synced_at" TIMESTAMPTZ,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "fitbit_connections_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "fitbit_oauth_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state_hash" TEXT NOT NULL,
    "encrypted_code_verifier" TEXT NOT NULL,
    "mobile_redirect_uri" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fitbit_oauth_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fitbit_oauth_attempts_state_hash_key" ON "fitbit_oauth_attempts"("state_hash");
CREATE INDEX "fitbit_oauth_attempts_user_id_expires_at_idx" ON "fitbit_oauth_attempts"("user_id", "expires_at");
CREATE INDEX "fitbit_connections_status_idx" ON "fitbit_connections"("status");
CREATE INDEX "daily_expenditure_aggregates_user_id_provider_local_date_idx" ON "daily_expenditure_aggregates"("user_id", "provider", "local_date");
CREATE INDEX "daily_intake_aggregates_user_id_provider_local_date_idx" ON "daily_intake_aggregates"("user_id", "provider", "local_date");

ALTER TABLE "provider_selections" ADD CONSTRAINT "provider_selections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fitbit_connections" ADD CONSTRAINT "fitbit_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fitbit_oauth_attempts" ADD CONSTRAINT "fitbit_oauth_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
