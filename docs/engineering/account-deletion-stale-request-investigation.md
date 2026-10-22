# Account deletion: stale repository request resurrection

October 21, 2026. Isolated investigation from deployed source `25ce192` on
`codex/deletion-stale-request`. **Confirmed local release-blocking defect; no fix,
deployment or production operation is contained in this checkpoint.** No private
production account identifiers, records, timestamps or health observations are
included here.

## Confirmed causal path

The request boundary authenticates a request and captures its existing internal
`{ id, email }`. Account deletion can then finish while that request is waiting.
`AccountSafetyService` persists intent, uses its provider/identity deletion ports,
and deletes the User with dependent rows via database cascades. A later resumed
`PrismaDashboardPreferencesRepository.get` calls `ensureUser`, whose User upsert has
a create branch containing the captured old ID/email and a fresh incomplete profile.
It does not include the original authenticated subject or initialization.

Consequently, the already-deleted UUID can be recreated as an unlinked User. The
request can complete successfully and create dashboard preferences under that UUID.
This is not caused by email-based identity matching: the verified-subject resolver
correctly creates a different User for a replacement subject using the same email.
Both the legitimate replacement and the stale recreated old UUID can coexist.

The local reproduction establishes this exact mechanism, not which particular
request initiated any production occurrence. Similar source paths are reachable
through other runtime User upserts and need bounded review; no claim that replacing
one dashboard upsert fixes the entire deletion lifecycle is justified.

## Actual local database reproduction

Created only `caloriebank_test_deletion_20261021_phase4j` on localhost PostgreSQL
17.10 and applied the existing **40 baseline migrations** there. No schema was
changed and no existing application/test/production database was modified.

`tools/contract-checks/deletion-resurrection.check.ts` is an explicit check outside
the ordinary API test glob. It rejects nonlocal/incorrect database names and query
overrides, then verifies actual database/address before writing synthetic data.
It uses the actual dashboard repository, deletion service, database cascade and
verified-subject resolver. Provider revocation and Clerk identity deletion are
injected synthetic ports; no external service is contacted.

Deterministic sequence:

1. Create a synthetic authenticated User with completed profile and initialization.
2. Start the dashboard repository request; pause immediately before its User upsert.
3. Complete actual account deletion; assert the old User and initialization are absent.
4. Resolve a replacement synthetic verified subject with the same email; assert a
   different UUID and intact new subject mapping.
5. Resume the old request. Unchanged source recreates the old UUID with null
   authentication fields, incomplete profile, no initialization, ledger or History.
6. Clean up only explicitly created synthetic User IDs by cascade.

Node 20.20.2 execution with `REPRO_EXPECT_UNSAFE=1`: **counterexample confirmed**
(one check passed because it explicitly expects the unsafe signature). Without
that switch the intended safety invariant is **RED**, with
`STALE_REQUEST_MUST_REJECT_AFTER_COMPLETED_DELETION`: actual fulfilled versus
expected rejected. This is not a passing safety qualification. Both runs cleaned
their synthetic accounts; the dedicated local schema remains for regression work.

```sh
TEST_DELETION_DATABASE_URL=postgresql://kouok@localhost/caloriebank_test_deletion_20261021_phase4j \
  node --import tsx --test tools/contract-checks/deletion-resurrection.check.ts
```

Use the repository-pinned Node 20 executable. The ordinary deployment-source
worktree has no newer runner script; no runtime was installed. Existing dependencies
were reused locally. The check intentionally never reads a production URL from
environment defaults.

## Smallest proposed correction boundary

For hosted authenticated execution, repositories must require an **existing,
non-deleting account**, never provision a missing User from request-owned ID/email.
Provisioning stays at verified identity resolution. A narrowly scoped helper can
perform a conditional existing-row update/read with `id` and
`deletionRequestedAt: null`; an absent/deleting account rejects before dependent
work. An UPDATE cannot recreate a deleted row. Retain bootstrap only for explicitly
local development, with a deliberate trusted configuration boundary, not an
implicit missing-account fallback in hosted execution.

Review all runtime create-capable upserts together: Today ingestion, dashboard
preferences, sync-session start, provider selection, provisional bank posting,
goal configuration, planned treats, Google Health OAuth initiation, FatSecret and
the deferred WHOOP service. Do not opportunistically change accounting formulas,
source authority or finalized records. Where writes must serialize with deletion
intent, use a transaction holding an existing User-row lock through dependent
writes, with consistent lock order. A preflight existence check followed by the
same create-capable upsert is not a fix.

Required regression matrix before qualification: completed-deletion stale request;
deletion-intent race; every hosted User-upsert replacement; existing authenticated
user behavior; same-email replacement subject remains a separate owner; explicit
local development bootstrap still works. A post-delete child insert should reject
its foreign key or be removed by the deletion cascade, never recreate its owner.

## Separate unresolved boundary

A still-valid previously issued credential reaching `resolveVerifiedClerkIdentity`
after its mapped User was deleted may enter that resolver's new-user provisioning
branch. Repository existing-account guards do **not** establish that this separate
identity lifecycle case is solved. No permanent deletion registry, tombstone,
retention commitment, migration or identity-policy change is authorized by this
investigation. Assess the credential/identity invalidation boundary separately
before claiming complete deletion safety.

## Limits and disposition

Confirmed local severity is at least P1: completed account deletion can be undone
by an already-authorized request. Other in-flight ingestion paths could repopulate
additional account data; this check does not claim to have reproduced every path,
cross-account leakage or ledger corruption. Release qualification for the affected
path remains blocked while root integration owns the fix decision. No production
cleanup, provider reconnect, accounting repair, build, push or deployment occurred.
