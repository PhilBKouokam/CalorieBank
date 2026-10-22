# Privacy-safe lifecycle failure classification

Local logging-only patch based on `9baaea2`; no deployment or production inspection
is part of this change. Dispatch, retry, finalization, provider authority, ledger
calculations and schemas are unchanged.

`lifecycle_user_failed` now emits only a static reason class and, for an actual
`PrismaClientKnownRequestError`, a code from a fixed allowlist. Relevant constraint,
schema, query, timeout, transaction and conflict codes are included; other Prisma
codes become `unknown`. Prisma-shaped objects do not qualify. Arbitrary exception
names, messages, metadata, SQL, account identifiers, health dates and amounts are
not copied into this event. The existing account suffix was removed from this
failure event, intentionally losing per-account correlation in exchange for a
strictly limited diagnostic payload. Other logging events were not refactored.

Focused tests exercise real Prisma error instances, unrecognized/contaminated
codes, poisoned exception names and look-alike objects. They also confirm a failed
account does not prevent the remaining dispatched accounts from completing and
does not alter summary counts. Fixtures contain synthetic values only; no private
production account or accounting observation is stored here.

Validate under Node 20 with the existing API-workspace Vitest configuration. No
database is needed for these tests. Root integration and any deployment require
separate review/authorization; this patch does not diagnose or repair an underlying
database/accounting error from the code alone.

Validation completed under Node 20.20.2: lifecycle suite **16 tests / one file
passed**, API TypeScript check passed, scoped ESLint passed, and whitespace check
passed. Initial sandbox execution could not bind the existing Supertest local HTTP
fixture; the approved outside-sandbox rerun passed all 16. No database, provider,
production service or account was contacted. No deployment was performed.
