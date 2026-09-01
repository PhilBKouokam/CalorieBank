CREATE TYPE "HistoricalSourceRole" AS ENUM ('EXPENDITURE', 'INTAKE');

CREATE TABLE "historical_source_authority_overrides" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "role" "HistoricalSourceRole" NOT NULL,
  "provider" TEXT NOT NULL,
  "intake_writer_bundle_identifier" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "historical_source_authority_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "historical_source_authority_overrides_user_id_local_date_role_key" ON "historical_source_authority_overrides"("user_id", "local_date", "role");
CREATE INDEX "historical_source_authority_overrides_user_id_local_date_idx" ON "historical_source_authority_overrides"("user_id", "local_date");
ALTER TABLE "historical_source_authority_overrides" ADD CONSTRAINT "historical_source_authority_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "historical_source_override_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "local_date" DATE NOT NULL,
  "role" "HistoricalSourceRole" NOT NULL,
  "option_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historical_source_override_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "historical_source_override_requests_user_id_idempotency_key_key" ON "historical_source_override_requests"("user_id", "idempotency_key");
CREATE INDEX "historical_source_override_requests_user_id_local_date_role_idx" ON "historical_source_override_requests"("user_id", "local_date", "role");
ALTER TABLE "historical_source_override_requests" ADD CONSTRAINT "historical_source_override_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bank_calculation_snapshots" ADD COLUMN "intake_writer_bundle_identifier" TEXT;
