# Phase 1A qualification and mixed-version rollout

Status: implementation in progress; not deployed or distributed.

Contract: [ADR 029](../product/adr-029-effective-dated-intake-authority.md).
Migration: `20260920000000_intake_authority_boundaries`.

The migration adds one indexed metadata table and seeds a nullable baseline from
valid persisted source selections. It does not reconstruct historical periods,
update accounting, call providers or alter existing records. Its insert is restart-safe.
Prisma's migration history controls successful deployment replay. The baseline is
not a claimed date of user consent. Period rows cascade on final account deletion
through the existing ordered provider-cleanup process.

Apple Health's old per-transport row cannot retain multiple writers. New additional
writer rows use a deterministic writer storage key. Existing rows and source record
identifiers are retained; an unattributed legacy row is never relabeled as a tracker.
Old client uploads receive the same server-side writer isolation.

Current selection remains the legacy known-source projection. Phase 1A production
mutations and source serialization do not accept `manual_estimate`. The new mobile
reader accepts future intake identities but provider-specific operations retain
closed validation and explicit known-source gates. Unknown sources do not become
external services in Settings. `available` is an authority-only future response
status, never emitted by Phase 1A. Today and History already carry display strings
and numeric values independently of the closed intake enum.

The additive rolling refresh plan identifies the exact source for each of at most
eight dates. Existing clients ignore it and remain safe: their evidence cannot
change dated/snapshotted authority. Compatibility clients use it to refresh prior
native writers still eligible for late evidence. A native query may inspect its
existing eight-day transport window for each needed writer; only sources owning
requested dates are requested, not all connected services. Source revision and
account-generation rejection remain in force. Legacy binaries cannot perform all
new historical refresh behavior until updated; server/accounting remains safe.

## Deployment sequence and rollback

Run the full release gate on a dedicated localhost test database, plus platform and
visual checks. Commit exactly the validated change before Render's established
migration/predeploy process. Verify health/readiness, lifecycle and provider logs.
Only then request one iOS and one Android store artifact. Qualify both physically,
including known-provider switches and a controlled unknown-source fixture, and
publish only to existing TestFlight/Play private testing channels. Record actual
build IDs and version floors here after qualification. None are assigned yet.

After any prospective switch, rolling back to an old backend ignoring authority
boundaries is unsafe. Retain date resolution in rollback code; suspend transitions
and lifecycle if necessary rather than reverting historical authority semantics.
No production repair or environment change is authorized by this document.

## Phase 1B gate

Do not equate a tester's update with all their devices being updated. A future
protocol capability must protect reads and writes for a manual-authority account.
Old requests must receive a qualified update-required error before serialization,
never a fake known source or an unparseable success body. Validate that existing
old client error/recovery paths do not reconnect or erase authority. A capability
header is protocol negotiation, not trusted identity; Clerk remains authoritative.
Build/version metadata alone cannot prove device authenticity and is not an access
control. No broad flag platform or manual enablement is introduced in Phase 1A.

Testers update through TestFlight or Google Play. No account recreation or blanket
provider reconnection is required. Actual version floors and the mixed-device error
qualification remain release evidence to collect; do not enable Phase 1B beforehand.

## Privacy decision

NO PUBLIC LEGAL PAGE UPDATE REQUIRED FOR PHASE 1A, based on the published source in
`web/legal/privacy.html`, sections 2–4: source identifiers, dates/update information,
source choices, calculation records and timezone are already described. The new
metadata records those same choices over time; no new health category, recipient,
advertising use or permission is introduced. The existing Play data-flow worksheet
already includes exact tracker packages, provider selection and timestamps. No
Google Play/Apple privacy category change is indicated by this implementation.
No legal page or store declaration is modified or submitted by this phase. Final
platform qualification must still confirm the unchanged binary permissions/SDKs.

### API/lifecycle cutover hold

`INTAKE_AUTHORITY_TRANSITIONS_ENABLED=0` is the hosted default. It rejects material intake transitions with a recoverable 409 while reads, refresh and existing accounting remain available. Local development enables transitions. Deploy the validated API and hourly lifecycle commit with the hold in place; only after both are verified may the API flag become `1`. This prevents an old lifecycle worker from processing new dated selections. Do not roll back to a pre-period resolver after transitions are enabled; disable transitions and roll forward with a corrected period-aware build.

The migration's null baseline remains a compatibility bridge until the first dated transition. During this window existing selection remains authoritative for unresolved dates, covering old instances that finish a source write during deployment. The first new transition atomically freezes the latest prior selection into that baseline. Posted snapshots remain authoritative throughout. No accounting table is recalculated by this bridge.

## Local qualification evidence — September 20, 2026

- Full `npm run release:friends-family`: 76 test files / 851 tests passed; TypeScript, lint, API/domain/schema builds, Prisma generate/validate and migration deploy passed on the dedicated local `caloriebank_test_phase1a_final_20260920` database. No test ran against production.
- Added 21 tests, including dated boundaries, exact writers, duplicate/concurrent transitions, source/finalization serialization, forward/backward DST, timezone travel, deletion/isolation, frozen legacy wire parsing, future-source read safety, rendered Settings and native refresh safeguards.
- Populated accounting fixture proves Opening Bank 500, subsequent finalized contribution -1,200 and Recovery 700 remain identical across metadata migration and ordinary intake switching, including snapshots, ledger, summary and History. Cronometer 2,716 → 3,149 same-source correction remains supported and idempotent.
- Expo iOS `testflight` and Android `play-testing` introspection passed using hosted beta/Clerk configuration. Generated Play manifest retains only `READ_NUTRITION`; burn/activity permissions are explicitly removed. iOS HealthKit entitlement remains enabled. Dependencies are up to date; Expo autolinking verification passed.
- Rendered actual Settings role component at 320/390 CSS pixels, normal and simulated 200% text: inspected wrapping, button reachability and neutral unknown-source copy. This is component-level React Native Web evidence, not physical VoiceOver/TalkBack or full-device qualification.
- Changed documentation links and `git diff --check` passed. No manual-intake option or editor added; only non-production fixtures contain a future manual source.
- Read-only production scale inspection before deployment: 10 users and 10 selected-intake rows. Migration is bounded metadata insertion, no accounting rewrite or external provider calls.

Physical iPhone/Pixel, deployed backend, private distribution, exact compatibility version floors and mixed-device runtime qualification remain pending. Automated legacy contract tests do not substitute for running the distributed binaries on devices.
