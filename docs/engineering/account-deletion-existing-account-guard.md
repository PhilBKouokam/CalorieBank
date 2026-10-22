# Existing-account repository guard — local correction

Historical Phase 4J checkpoint. The subsequent local Phase 4K correction and
qualification are recorded in [account-deletion-identity-serialization.md](account-deletion-identity-serialization.md).

October 21, 2026. Local-only follow-up to reproduction `f9f35e8`, based on deployed
`25ce192`. No production service/database, provider, Clerk account or deployment
branch was changed. This closes the reproduced repository path, not every possible
identity/deletion race.

## Runtime behavior

`requireExistingRequestAccount` uses one conditional User UPDATE scoped by the
resolved internal ID and `deletionRequestedAt: null`. Exactly one matched existing
row is required. An absent or deleting owner now receives HTTP **409**, code
`ACCOUNT_UNAVAILABLE`, with neutral “This account is unavailable.” No create
fallback exists. It retains descriptive email updates for an existing live account.

All ten runtime User-upsert locations now use the guard: Today ingestion, dashboard
preferences, sync-session start, provider selection, provisional bank posting,
Fitness Goal, Banking Goal/planned treat, Google Health initiation, FatSecret
initiation and deferred WHOOP initiation. Runtime modules no longer provision Users.
Inside an existing transaction, the UPDATE holds its User-row lock through dependent
writes. Outside one, deletion after the guard can remove dependent rows or cause
later foreign-key writes to reject; it cannot recreate the parent User.

Local development remains explicit: only `AUTH_MODE=development` together with
`APP_ENV=local` provisions its configured development identity at the existing
authentication boundary. It still rejects bearer credentials before provisioning.
The initial local profile uses a validated first-request timezone when provided,
otherwise UTC; existing profile timezone is not rewritten. It does not eagerly
create Opening Bank initialization. No runtime repository inspects global auth
settings or silently falls back to development creation.

Hosted Clerk subject resolution is unchanged. The guard does not change canonical
bank calculations, source selection, append-only records, finalization policy,
migrations, provider permissions or API response shapes on successful requests.
Mobile/native code is untouched and existing passing physical tests remain closed.

## Regression evidence

The same dedicated localhost PostgreSQL database and existing 40 migrations from
the reproduction were used, with synthetic identities and stub external ports.
The unchanged-source invariant was RED. After this patch the default safe check is
**GREEN**: completed account deletion stays deleted after the paused dashboard
request resumes; it rejects instead of recreating the old UUID. A replacement
subject with the same email remains a different intact owner.

A second real-database check proves persisted deletion intent rejects dashboard,
sync-session and expenditure-ingestion work without adding rows or clearing intent.
Both checks clean only their explicitly created synthetic accounts. Guard unit/API
checks cover missing owners, database failure propagation, local bootstrap, bearer
conflict and the architectural ban on User provisioning in runtime modules.

Node **20.20.2** results:

- Complete API suite: **1,143 tests / 111 files PASS**.
- Focused affected compatibility suite: **74 tests / 11 files PASS**.
- Explicit actual-database deletion barriers: **2 checks PASS**.
- API TypeScript, strict standalone check types, API source compilation, scoped
  ESLint and whitespace checks passed.

Initial full-suite failures exposed legacy fixtures that asked repositories to
create absent test owners, an OAuth unit stub missing the new UPDATE operation,
and local bootstrap timezone/initialization timing. The runtime local compatibility
issues were corrected. Persistence fixtures now explicitly create their test
owners; the OAuth stub models the existing-account conditional update. No existing
accounting or safety expected result was relaxed. Complete API rerun passed.

This is API/source qualification, not a new native/store/full release-candidate
gate. No Prisma client was regenerated in shared dependencies, and no production
migration or data cleanup was attempted.

## Explicit residual — still OPEN

An identity already verified before deletion can be resolved after its old User is
removed. The unchanged `resolveVerifiedClerkIdentity` create branch can then
provision a new internal User for that captured subject. This is an in-flight
verified-identity race, not solely a question of validating a later JWT. Repository
existing-account guards do **not** solve it. No network identity-validation,
tombstone, permanent deletion registry, retention policy or schema change is
included or inferred. The affected public release remains blocked until this
separate boundary is assessed and any production change is explicitly approved.

### Subsequent characterization of the residual

An additional explicit localhost check now demonstrates this second path using
the actual unchanged verified-subject resolver and completed deletion service.
A verified subject is captured before deletion; after deletion removes its mapping,
passing that captured identity to the resolver provisions a **new UUID** with the
same subject and a fresh pending initialization. This does not resurrect the
deleted UUID, so the existing-account guard cannot detect it. External identity and
provider ports remain synthetic; no JWT or Clerk network behavior is tested or
changed. The characterization's expected unsafe observation is not a safety PASS.
This exported-resolver behavior is confirmed locally and stays **OPEN** for
production-boundary assessment, distinct from the two passing
repository/deletion-intent safety checks. It must be assessed and explicitly
dispositioned before claiming complete account-deletion qualification.

The characterization calls the exported resolver directly, as the injected test
identity verifier does; it does not reproduce the complete production middleware.
Production `requireUser` first looks up the subject and returns an existing mapping
directly. Only a missing mapping calls Clerk `users.getUser` before invoking the
resolver. A request beginning after successful Clerk deletion should fail that
network lookup; this check does not show that a deleted account's JWT alone can
provision an account. A production provisioning race would require an initially
missing mapping and a successful Clerk lookup captured before deletion, with
concurrent account provisioning/deletion before the resolver's second lookup.
Those structural prerequisites and remote identity timing are not demonstrated by
this local characterization. The production auth boundary remains unchanged.
