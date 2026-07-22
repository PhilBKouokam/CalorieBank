-- Align manually-authored aggregate tables with Prisma's datamodel output.
ALTER TABLE "daily_expenditure_aggregates" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "daily_intake_aggregates" ALTER COLUMN "id" DROP DEFAULT;

ALTER INDEX "daily_expenditure_aggregates_user_id_provider_provider_record_id_key"
  RENAME TO "daily_expenditure_aggregates_user_id_provider_provider_reco_key";
