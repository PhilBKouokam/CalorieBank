-- CreateTable
CREATE TABLE "planned_treats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "required_calories" INTEGER NOT NULL,
    "target_date" DATE,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "planned_treats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planned_treats_required_calories_check" CHECK ("required_calories" BETWEEN 1 AND 20000),
    CONSTRAINT "planned_treats_name_not_blank_check" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "planned_treats_name_length_check" CHECK (char_length("name") <= 80)
);

-- CreateIndex
CREATE UNIQUE INDEX "planned_treats_user_id_key" ON "planned_treats"("user_id");

-- AddForeignKey
ALTER TABLE "planned_treats" ADD CONSTRAINT "planned_treats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
