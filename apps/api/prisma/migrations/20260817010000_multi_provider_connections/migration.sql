CREATE TABLE "external_provider_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ NOT NULL,
    "refresh_token_expires_at" TIMESTAMPTZ,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_refreshed_at" TIMESTAMPTZ,
    "last_synced_at" TIMESTAMPTZ,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "external_provider_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_provider_oauth_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "state_hash" TEXT NOT NULL,
    "mobile_redirect_uri" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_provider_oauth_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_provider_connections_user_id_provider_key"
ON "external_provider_connections"("user_id", "provider");
CREATE INDEX "external_provider_connections_provider_status_idx"
ON "external_provider_connections"("provider", "status");
CREATE UNIQUE INDEX "external_provider_oauth_attempts_state_hash_key"
ON "external_provider_oauth_attempts"("state_hash");
CREATE INDEX "external_provider_oauth_attempts_user_id_provider_expires_at_idx"
ON "external_provider_oauth_attempts"("user_id", "provider", "expires_at");

ALTER TABLE "external_provider_connections"
ADD CONSTRAINT "external_provider_connections_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_provider_oauth_attempts"
ADD CONSTRAINT "external_provider_oauth_attempts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
