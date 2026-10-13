CREATE TABLE "daily_intake_adjustments" (
 "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "local_date" DATE NOT NULL,
 "mode" TEXT NOT NULL CHECK ("mode" IN ('replace', 'add', 'none')),
 "calories" INTEGER NOT NULL CHECK ("calories" BETWEEN 0 AND 100000),
 "revision" INTEGER NOT NULL CHECK ("revision" > 0),
 "provider" TEXT NOT NULL,
 "writer_id" TEXT,
 "source_id" TEXT,
 "timezone" TEXT NOT NULL,
 "updated_at" TIMESTAMPTZ NOT NULL,
 PRIMARY KEY ("user_id", "local_date")
);
