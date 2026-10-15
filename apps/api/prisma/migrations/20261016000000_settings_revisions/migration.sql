CREATE TABLE "settings_revisions" (
  "user_id" UUID NOT NULL,
  "setting" TEXT NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "settings_revisions_pkey" PRIMARY KEY ("user_id", "setting"),
  CONSTRAINT "settings_revisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
