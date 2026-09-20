# Phase 1A qualification and mixed-version rollout

Status: backend deployed and both compatibility builds privately available; physical qualification remains pending.

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
publish only to existing TestFlight/Play private testing channels. The delivered
build IDs and candidate version floors are recorded below; physical qualification
is required before treating those floors as fully qualified.

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

At local gate completion, backend deployment and mobile delivery were still pending; their subsequent results are recorded below. Physical iPhone/Pixel and mixed-device runtime qualification remain outstanding. Automated legacy contract tests do not substitute for running distributed binaries on devices.


## Backend delivery — September 20, 2026

Implementation and architecture documentation commit: `16e76c7a4c3f3ee8c36da43e2b7c81bc83f9709f` (37 files), pushed to `codex/private-beta-release`.

Render API deployment `dep-dao5ng7lk1mc73fsuep0` applied the additive migration successfully and went live. Lifecycle build `bld-dao5ngflk1mc73fsufd0` uses the same commit. A normal triggered lifecycle run completed all 10 accounts with zero failed accounts; five provider warnings match the previous scheduled run's count (visible Fitbit HTTP 409 warnings). This is bounded operational observation, not proof that every provider account is healthy.

After both services were qualified, only the related API setting `INTAKE_AUTHORITY_TRANSITIONS_ENABLED=1` was added. Save-and-deploy reused the validated code (`dep-dao5pkugekts73b0bo5g`, live). Read-only shell verification confirmed the exact commit, flag `1`, 10 authority baseline rows, zero dated rows and zero unknown current selections. `/health` and `/health/ready` returned HTTP 200 with database ready. No manual source or production data repair was introduced.

## Compatibility artifacts dispatched

- iOS 1.0.0 (4): `5e61e52d-2251-4304-86a3-2762470731b3`, profile `testflight`.
- Android 1.0.0 (3): `ff88d10a-4afd-46ab-9b26-7b59b022022f`, profile `play-testing`, AAB.
- Both source commit `16e76c7`; exactly one remote build request per platform. Artifact completion, store availability and physical qualification must be recorded separately.
- Candidate future protocol floors are iOS build 4 / Android versionCode 3, subject to actual physical qualification. They are not sufficient alone to permit an old device on the same manual account; Phase 1B still needs the documented read/write capability gate and explicit founder authorization.

### Acceptance matrix and evidence limits

| Area | Result / evidence |
| --- | --- |
| ADR-016 conflict | Intake global-change reconciliation superseded by ADR 029; expenditure behavior and explicit bounded historical correction remain unchanged. |
| Effective authority | Account-owned indexed civil-date boundaries include exact Apple writer / Android package; identical retries are no-ops and account advisory locking serializes competing writes with posting. |
| Current selection | Existing known-source response stays available; civil-date reads project active authority, including travel across a boundary. |
| Ordinary switch | Effective immediately for current unposted local day; prior completed dates do not switch. Backwards-date or already-posted current-day transitions reject recoverably. |
| Late evidence | Same snapshotted source may revise provisional accounting under existing correction/locking rules; transport identity alone is insufficient. |
| Finalized/History | Posted source/value snapshot owns the day; existing provisional corrections append versions/deltas, locked records remain locked. History uses snapshots. |
| Opening Bank | Initialized evidence immutable. Incomplete preparation may retry with explicitly changed preparation context; no new preparation truth. |
| Unknown wire identity | Compatibility reader accepts future intake identifier; known provider operation schemas stay closed. Numeric Today/History contracts stay readable; Settings uses neutral authority status, not external connectivity. |
| Write firewall | No automatic default substitution or unknown-provider query; explicit burned-only setup writes remain role-scoped. Real future source mutation rejected by Phase 1A server. |
| Legacy compatibility | Frozen independent pre-1A intake enum accepts all three emitted provider values. Live database contains zero unknown selections. Actual old-binary device journeys remain unqualified. |
| Accounting | Local populated migration/switch fixture compares Opening Bank, effective/Available Bank, Recovery, records, snapshots, ledger and History; unchanged. |
| Boundary/races | Local DB tests cover DST transitions, travel-date rejection, competing/duplicate switches and actual first-posting/source-switch serialization. |
| Isolation/deletion | Account-scoped queries/FK and cascade tested; existing ordered provider cleanup retained. No manual records introduced. |
| Permissions | Config introspection confirms Play Nutrition-only and disabled Health Connect burn; physical installed-binary permission check remains pending. |
| Physical | No iPhone/Pixel journey or native accessibility result claimed from automated/component rendering. |
| Scope | Manual Intake, Eating Budget, Home/Steps redesign, Banking Goal 2.0 and all other deferred product features remain absent. No public release or declaration change. |

Phase 1B is **not yet cleared**. Complete private distribution and physical qualification, then obtain explicit Phase 1B authorization; its enablement must also implement and qualify the mixed-version read/write gate described above.


### iOS artifact and upload

Build `5e61e52d-2251-4304-86a3-2762470731b3` finished successfully, version 1.0.0 (4), and EAS submission `163a6dac-268e-449e-bb7f-ab8100f61dd6` finished uploading to existing ASC app `6810346827`. The IPA's bundle/version, signed HealthKit entitlement and production APNs entitlement were inspected. Restoring original ZIP executable permissions was necessary for normal local `codesign` inspection; an initial extraction-related warning is not counted as a successful check.

Added a narrow `submit.testflight.ios.ascAppId` EAS profile referencing that existing app, so submission names an explicit build and cannot accidentally target a different app. This submission-only configuration does not alter either compiled artifact. No signing key, certificate, profile, push key or permission was changed.


Apple processed build 4 and the existing Friends & Family group now lists **1.0.0 (4) — Testing**, with older builds 3 and 2 retained. The normal private Beta App Review submission completed without a remaining review hold. No public link or new testers were added; no public App Store review/release occurred. Physical iPhone acceptance remains outstanding.

### Android artifact

EAS AAB `ff88d10a-4afd-46ab-9b26-7b59b022022f` finished successfully: `com.caloriebank.mobile`, 1.0.0, versionCode 3, compile SDK 36. The actual compiled AAPT2 manifest contains exactly `android.permission.health.READ_NUTRITION` and no other Health Connect permission. Health Connect burn remains disabled. SHA-256: `bda3571b5c885c626bb0e9ef1b6ab4356c947e9eb1fa0e77c8f1a8db0a0c4e82`.

Uploaded that same AAB to the existing Internal Testing release flow. Private rollout/Google processing and physical Pixel acceptance are distinct remaining checks at this point; no APK distribution or second cloud build was used.


### Changed-file inventory

```text
AGENTS.md
apps/api/prisma/migrations/20260920000000_intake_authority_boundaries/migration.sql
apps/api/prisma/schema.prisma
apps/api/src/app.ts
apps/api/src/env.ts
apps/api/src/modules/bank-history/bank-history.repository.ts
apps/api/src/modules/bank-history/day-source-authority.ts
apps/api/src/modules/lifecycle/account-lifecycle.service.ts
apps/api/src/modules/native-intake/native-intake.routes.ts
apps/api/src/modules/provider-selection/intake-authority.ts
apps/api/src/modules/provider-selection/provider-selection.repository.ts
apps/api/src/modules/today/provider-catalog.ts
apps/api/src/modules/today/today.repository.ts
apps/api/tests/account-lifecycle.test.ts
apps/api/tests/consumer-routes.test.ts
apps/api/tests/historical-source-authority.persistence.test.ts
apps/api/tests/intake-authority.persistence.test.ts
apps/api/tests/intake-forward-compatibility.test.ts
apps/api/tests/native-intake-client.test.ts
apps/api/tests/onboarding-journeys.test.ts
apps/api/tests/opening-source-change.persistence.test.ts
apps/api/tests/provisional-reconciliation.persistence.test.ts
apps/api/tests/today-ingestion.test.ts
apps/mobile/app/(onboarding)/onboarding.tsx
apps/mobile/app/(settings)/integrations.tsx
apps/mobile/eas.json
apps/mobile/lib/api/client.ts
apps/mobile/lib/healthkit/healthkit-connection.ts
apps/mobile/lib/native-health/intake.android.ts
apps/mobile/lib/providers/presentation.ts
docs/deployment/intake-authority-phase1a.md
docs/engineering/source-selection-state-machine.md
docs/product/adr-016-authoritative-provider-selection-and-multi-provider-resolution.md
docs/product/adr-029-effective-dated-intake-authority.md
docs/product/android-parity-plan.md
docs/product/manual-estimated-intake.md
docs/product/v1-prd.md
packages/schemas/src/index.ts
```


## Final distribution and qualification status

Google Play release **1.0.0 (3) — Friends & Family compatibility** is **Available to internal testers**, released September 20 at 5:53 PM CDT, one version code, **Not reviewed**. The Console retains its existing temporary unreviewed app name. Its sole release warning is no deobfuscation mapping file. No listing/declaration drafts were submitted; no Production/Open Testing track or public link was created. Tester update availability can lag the Console status.

TestFlight **1.0.0 (4) — Testing** is available to the existing Friends & Family group. Existing testers update in TestFlight; Play testers update through their established Internal Testing enrollment. Neither platform requires account recreation or provider reconnection merely for Phase 1A.

**POST-ANDROID PHASE 1A: PASS CANDIDATE — physical iPhone and Pixel compatibility/source-switch qualification remains.**

Outstanding acceptance: installed compatibility builds on iPhone and Pixel; Today/History/Settings, explicit provider switching with unchanged historical/Opening Bank snapshots, relaunch/foreground/offline/account switching, notification smoke, and controlled unknown-source device handling. Current tools exposed no controllable physical device; device access/qualification was requested, but no physical result has been received. Rendered and automated checks must not be presented as physical acceptance. Old installed iOS/Android binaries also have not been physically exercised against this backend in this run; frozen legacy contract tests and known-only live selections are the available compatibility evidence.

Is it now safe to implement and privately enable `manual_estimate` without breaking distributed clients or rewriting historical authority? **NO**: physical compatibility qualification remains, and future enablement requires the specified mixed-version read/write capability gate. No manual source is enabled. Phase 1B requires a separate founder authorization after qualification; no later backlog work was started.

The next authorized work is completing these Phase 1A physical checks. The next product implementation phase, only after clearance and explicit authorization, is Phase 1B Manual/Estimated Intake; Daily Eating Budget remains later.
