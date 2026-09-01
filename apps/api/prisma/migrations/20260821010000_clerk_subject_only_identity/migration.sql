-- Clerk subject is the external identity boundary. Email can be reused when a
-- deleted Clerk user is recreated, so it must not merge or block accounts.
DROP INDEX IF EXISTS "users_email_key";
