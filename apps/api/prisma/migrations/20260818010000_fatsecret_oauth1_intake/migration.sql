ALTER TABLE "external_provider_connections"
ADD COLUMN "auth_protocol" TEXT NOT NULL DEFAULT 'oauth2',
ADD COLUMN "encrypted_token_secret" TEXT;

ALTER TABLE "external_provider_connections"
ALTER COLUMN "encrypted_refresh_token" DROP NOT NULL,
ALTER COLUMN "access_token_expires_at" DROP NOT NULL;

ALTER TABLE "external_provider_oauth_attempts"
ADD COLUMN "encrypted_request_token" TEXT,
ADD COLUMN "encrypted_request_token_secret" TEXT;
