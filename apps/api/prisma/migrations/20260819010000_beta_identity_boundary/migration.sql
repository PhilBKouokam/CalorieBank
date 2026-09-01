ALTER TABLE "users"
ADD COLUMN "auth_provider" TEXT,
ADD COLUMN "auth_subject" TEXT;

CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");
