ALTER TABLE "provider_selections"
ADD COLUMN "expenditure_selected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "intake_selected" BOOLEAN NOT NULL DEFAULT false;

-- Existing choices remain usable. Generic Apple Health access is not a food selection.
UPDATE "provider_selections" SET
  "expenditure_selected" = true,
  "intake_selected" = (
    "authoritative_intake_provider" = 'fatsecret'
    OR ("apple_health_intake_writer_bundle_id" IS NOT NULL
      AND "apple_health_intake_writer_display_name" IS NOT NULL
      AND lower("apple_health_intake_writer_display_name") NOT IN ('choose a food tracker', 'apple health food tracker'))
  );
