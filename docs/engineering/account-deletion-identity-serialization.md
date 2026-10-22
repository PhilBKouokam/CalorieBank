# Account deletion — serialized identity provisioning

October 22, 2026. Local candidate on `codex/deletion-stale-request`, based on
`25ce192` plus `f9f35e8`, `645234c`, `f12a653`. No deployment, production reads,
provider/Clerk network calls, schema changes or retained deletion registry.

## What is corrected

The original reproduced stale repository path remains protected by the Phase 4J
existing-account UPDATE guard. Phase 4K addresses the separate captured-identity
provisioning boundary: production previously fetched a missing subject from Clerk
before calling the resolver, leaving a narrow concurrent provisioning/deletion
window. This was not evidence that a deleted JWT alone could bypass Clerk.

Both missing-account provisioning and final identity/data deletion now use a
PostgreSQL transaction advisory lock with fixed namespace `1128417100` and a
subject hash. Full subject equality still controls every identity lookup. A hash
collision merely serializes unrelated subjects. The lock is released on
commit/rollback; no subject, tombstone, signup prohibition or retention is stored.
No account is selected by email, and a deliberate new subject reusing an email
still receives an isolated new account without old records.

The exported resolver requires a fresh-identity port; captured identity metadata
cannot create a User by itself. While holding the lock it rechecks the mapping,
rejects deletion intent, and, only if missing, fetches the fresh identity before
creating. Production uses Clerk `users.getUser` there. SDK 404 maps to static
401 `AUTHENTICATION_REQUIRED`; service errors map to static 503 without SDK
payloads. The production mapped fast path remains network-free and rejects deletion
intent except for the two existing authenticated cleanup routes: exactly
`DELETE /v1/me/account` and `DELETE /v1/me/morning-bank-update/device`. The exported
resolver defaults to denial; only those request contexts permit an existing
deleting mapping. Missing mappings still require fresh identity authority and
cannot bypass a deleted identity. Ordinary reads (including support diagnostics),
provider routes, POST and near-match DELETE paths remain denied. Existing deletion
confirmation and rate limits remain unchanged. Injected test identity ports are trusted synthetic
authorities, not proof of remote Clerk behavior.

Deletion keeps its existing order: durable intent, push deactivation, provider
revocation, then the shared subject lock around identity deletion and the local
cascade. Once it owns the lock it rechecks that the internal owner still exists.
Independent deletion instances converge; missing identities (404) and missing
local owners remain idempotent. Local database failures retry the whole
transaction, not queries inside an aborted transaction. If remote identity deletion
succeeds and the local transaction fails, durable intent remains for worker retry.

Lock acquisition is bounded by PostgreSQL's 5-second lock timeout; pool acquisition
is bounded to 10 seconds and the interactive transaction to 30 seconds. Remote
identity work is bounded to 8 seconds, including existing transient deletion
retries. On timeout the caller cannot resume writes and the retry loop stops
starting additional remote calls. A transport already in flight may finish later;
this change does not claim the SDK transport is cancellable. Missing/deleting
accounts fail closed, and pending deletion can be retried.

## Callbacks, workers and operator paths

Google Health, FatSecret and deferred WHOOP callbacks check an existing live owner
before exchange. Connection persistence conditionally updates/locks that owner
inside the same transaction as conditional consumption of the still-unconsumed,
unexpired, owned attempt and connection upsert. If intent wins, no connection is
stored. If callback persistence wins, deletion's intent UPDATE waits for that row
lock, so subsequent revocation sees the committed connection. Delayed/consumed/
expired responses cannot restore local ownership or credentials. An already-issued
remote response or unpersisted remote grant is not claimed to be revoked by these
local checks; shared Google grant behavior is unchanged.

Lifecycle work rechecks owner existence/deletion intent at entry, before every
provider retry and before finalization. A worker selected before deletion therefore
does not start new provider work after discovering deletion. Existing notification
eligibility checks independently deny missing/deleting owners before transport.
Already in-flight provider traffic or an accepted generic push cannot be recalled.
The correction does not claim otherwise. All guarded repositories prohibit parent
User recreation, and PostgreSQL foreign keys/cascade protect deleted ownership.

The only runtime User creation sites are the shared explicit local-development
identity helper and serialized Clerk provisioning. Local startup invokes the same
helper before synthetic ingestion; HTTP local authentication invokes it before
repository access. The helper asserts both `APP_ENV=local` and
`AUTH_MODE=development`, preserves the initial timezone, and has no hosted fallback. The operator-only
identity linking command updates an existing row; it was not executed. Local
bank-history seeding now requires an existing development owner and cannot create
an absent account via repositories. No callback/worker can provision User.

## Qualification

Dedicated synthetic localhost database:
`caloriebank_test_deletion_20261021_phase4j`. It contains only the existing **40**
migrations; none were added. Generated Prisma output uses worktree-private copies,
with workspace package links pointing to this candidate, not modified shared
outputs. No dependencies were installed.

Real PostgreSQL contract checks cover repository stale-request deletion barriers,
deletion intent, captured identity after deletion, concurrent independent deleters,
concurrent provisioning convergence, distinct subjects, new subject/same email,
interrupted cascade rollback and independent 404 resume, identity failures/mismatch,
callbacks returning after intent/completion, consumed/expired attempts, and a real
lock timeout followed by successful retry. API adapter tests exercise production
`getUser` ordering and safe status mapping using SDK stubs, plus bounded late
completion. Worker tests cover missing/deleting owners selected earlier.

Commands (Node **20.20.2**):

```sh
PATH=/Users/kouok/.nvm/versions/node/v20.20.2/bin:$PATH \
TEST_DATABASE_URL=postgresql://kouok@localhost/caloriebank_test_deletion_20261021_phase4j \
node --import tsx apps/api/src/scripts/release-friends-family.ts

TEST_DELETION_DATABASE_URL=postgresql://kouok@localhost/caloriebank_test_deletion_20261021_phase4j \
/Users/kouok/.nvm/versions/node/v20.20.2/bin/node --import tsx --test \
tools/contract-checks/deletion-resurrection.check.ts
```

The complete release gate includes private Prisma generation/validation, existing
migration deploy/status, all workspace types, API/mobile lint, complete API tests,
API build and whitespace check. Exact final results are appended after completion.
These are local source/database checks; native/store qualification is preserved,
not repeated or reclassified as physical proof.

## Deployment boundary and rollback

This candidate requires root independent review and explicit production-deployment
authorization. No production orphan cleanup or identity re-linking is included.
Keep the deletion P1 release hold until the complete correction is reviewed,
approved, deployed and the separately agreed focused qualification is complete.
If the candidate causes service failures, stop affected release/provisioning work;
reverting to a known resurrection-prone implementation must not be treated as a
safe account-deletion rollback. No database rollback is required because no schema
or accounting policy changed. Existing pending intent remains resumable.

### Final local results

- Complete Node **20.20.2** release gate: **PASS**, **1,154 tests / 112 files**;
  Prisma generation/validation, **40** existing migrations with none pending,
  API/mobile/domain/schema type checks, API/mobile lint, API build and diff checks.
- Explicit real PostgreSQL adversarial checks: **14/14 PASS**. These are safety
  assertions, replacing the earlier expected-unsafe resolver characterization.
  Callback-persistence-first ordering also proves revocation observes the
  committed connection before the final cascade.
- Strict standalone TypeScript and scoped ESLint for the explicit database check:
  **PASS**. No mocked result is represented as native or production proof.
- Full-gate initial failures were an unused import and a legacy account-safety
  mock without transaction support; both were corrected. No existing safety or
  accounting expected result was relaxed. The final complete rerun passed.

### Required coordinated server handoff

The lock protocol is complete only when **both** API and hourly lifecycle worker
run this corrected candidate and every old process/job/in-flight request has
drained. Older API provisioning and older worker repository/deletion code do not
participate in the lock protocol. A mixed old/new server interval is **not**
qualified safe. Compatibility with existing mobile clients is a separate concern:
no mobile wire schema or permissions changed here.

Before any approved deployment, prepare an explicit bounded quiescent handoff:
pause old scheduled execution and stop accepting affected account mutations,
wait for old requests/jobs to terminate, replace both API and worker, verify both
source versions and absence of old work, then resume processing and perform only
the agreed focused qualification. The exact host controls and permitted downtime
must be checked and included in deployment authorization; this document does not
invent an available maintenance switch or perform those actions. If quiescence
cannot be demonstrated, retain the P1 hold and do not run new deletion
qualification during the handoff. Reverting API to `9baaea2` or worker to `25ce192`
reopens the P1; it is not a safe deletion rollback. No data restoration or schema
rollback is required or authorized by this local correction.


The final compatibility follow-up preserves the existing pending-deletion account
retry and device cleanup paths for a verified, still-mapped owner. Actual HTTP
middleware/router/service regressions exercise a provider failure persisting
intent, denied ordinary requests, device cleanup, rejected wrong confirmation,
then successful deletion retry without User creation. Both production SDK-adapter
and injected-verifier branches are tested. A fresh local startup regression
creates its synthetic owner through the explicit identity helper before ingestion,
checks data/timezone and zero ledger effects, and rejects hosted/Clerk bootstrap.


The explicit database tool additionally runs the actual scheduled coordinator
against a real eligible synthetic profile. Its actual profile query is restricted
to that one owner and paused after selection; completed deletion then removes the
owner before the captured result resumes. The real Prisma owner guard rejects the
job, no provider/finalization/delivery port is called, and User, aggregate,
initialization, History and ledger rows stay absent. Only external/accounting
ports are fail-fast synthetic stubs. This proves the selected-before-delete worker
case, not cancellation of a call already in flight. The provisioning test is
accurately named concurrent convergence followed by deletion; it does not claim
to observe deletion waiting during the fresh check. The callback-first test proves
commit/revocation ordering, without asserting a measured lock wait. These targeted
checks do not claim to exercise every provider end to end; the source inventory
and full API suite cover the other guarded call sites.

The stale-dashboard deletion/recreation check now starts with a nonempty negative
control. Using the established Opening Bank persistence fixture pattern, it stores
synthetic Apple Health expenditure plus an exact synthetic intake writer, completes
the bounded import evidence, initializes Opening Bank through the actual bank
repository, then posts a completed day through that repository. Before deletion,
all six counts are strictly positive: expenditure aggregates, intake aggregates,
History, ledger, calculation snapshots and Opening calculation days. Actual account
deletion must reduce all six old-owner counts to zero. A fresh subject with the
same email must have zero of all six, a fresh waiting initialization, and no old
opening amount or accounting-start date. The paused stale repository request is
then released and still must reject without recreating the deleted owner. This is
synthetic local evidence; no real records or direct ledger-insertion shortcut is
used. The complete explicit PostgreSQL tool remains **14/14 PASS**, with strict
standalone TypeScript and lint passing; production/runtime source is unchanged.
