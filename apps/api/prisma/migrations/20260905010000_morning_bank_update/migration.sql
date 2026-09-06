CREATE TYPE "MorningBankUpdateDeliveryStatus" AS ENUM (
  'ATTEMPTING',
  'NO_TOKEN',
  'RETRYABLE_FAILURE',
  'PERMANENT_FAILURE',
  'DELIVERED'
);

CREATE TABLE "morning_bank_update_preferences" (
  "user_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "morning_bank_update_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "push_device_registrations" (
  "user_id" UUID NOT NULL,
  "expo_push_token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_registered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invalidated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "push_device_registrations_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "morning_bank_update_deliveries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "completed_local_date" DATE NOT NULL,
  "status" "MorningBankUpdateDeliveryStatus" NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ,
  "next_retry_at" TIMESTAMPTZ,
  "delivered_at" TIMESTAMPTZ,
  "expo_ticket_id" TEXT,
  "receipt_checked_at" TIMESTAMPTZ,
  "failure_code" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "morning_bank_update_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_device_registrations_expo_push_token_key" ON "push_device_registrations"("expo_push_token");
CREATE INDEX "push_device_registrations_active_idx" ON "push_device_registrations"("active");
CREATE UNIQUE INDEX "morning_bank_update_deliveries_user_id_completed_local_date_key" ON "morning_bank_update_deliveries"("user_id", "completed_local_date");
CREATE INDEX "morning_bank_update_deliveries_status_next_retry_at_idx" ON "morning_bank_update_deliveries"("status", "next_retry_at");

ALTER TABLE "morning_bank_update_preferences" ADD CONSTRAINT "morning_bank_update_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_device_registrations" ADD CONSTRAINT "push_device_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "morning_bank_update_deliveries" ADD CONSTRAINT "morning_bank_update_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
