-- Match the Prisma relation's update policy as well as account-deletion cascade.
ALTER TABLE "daily_intake_adjustments"
  DROP CONSTRAINT "daily_intake_adjustments_user_id_fkey",
  ADD CONSTRAINT "daily_intake_adjustments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
