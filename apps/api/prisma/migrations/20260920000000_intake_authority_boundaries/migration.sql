BEGIN;
-- Metadata only: never update provider evidence, snapshots or accounting.
CREATE TABLE "intake_authority_boundaries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "effective_from" DATE,
  "provider" TEXT NOT NULL,
  "writer_id" TEXT,
  "source_id" TEXT,
  "timezone" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "intake_authority_boundaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "intake_authority_boundaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "intake_authority_identity" CHECK (
    (provider = 'apple_health' AND writer_id IS NOT NULL AND length(writer_id) > 0 AND source_id IS NULL) OR
    (provider = 'health_connect' AND source_id IS NOT NULL AND length(source_id) > 0 AND writer_id IS NULL) OR
    (provider NOT IN ('apple_health', 'health_connect') AND writer_id IS NULL AND source_id IS NULL)
  ),
  CONSTRAINT "intake_authority_provider_nonempty" CHECK (length(provider) BETWEEN 1 AND 100),
  CONSTRAINT "intake_authority_date_timezone" CHECK (effective_from IS NULL OR timezone IS NOT NULL)
);
CREATE UNIQUE INDEX "intake_authority_boundaries_user_id_effective_from_key" ON "intake_authority_boundaries"("user_id", "effective_from");
CREATE UNIQUE INDEX "intake_authority_one_baseline" ON "intake_authority_boundaries"("user_id") WHERE effective_from IS NULL;
INSERT INTO "intake_authority_boundaries" (user_id, provider, writer_id, source_id)
SELECT user_id, authoritative_intake_provider,
  CASE WHEN authoritative_intake_provider = 'apple_health' THEN apple_health_intake_writer_bundle_id END,
  CASE WHEN authoritative_intake_provider = 'health_connect' THEN native_intake_source_id END
FROM provider_selections
WHERE intake_selected AND (
  (authoritative_intake_provider = 'apple_health' AND length(apple_health_intake_writer_bundle_id) > 0) OR
  (authoritative_intake_provider = 'health_connect' AND length(native_intake_source_id) > 0) OR
  authoritative_intake_provider = 'fatsecret'
)
ON CONFLICT DO NOTHING;
COMMIT;
