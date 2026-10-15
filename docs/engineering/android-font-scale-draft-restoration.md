# Android font-scale correction and session drafts

Implementation checkpoint: October 15, 2026, based on `083f995`.
Local implementation and one isolated synthetic diagnostic APK are authorized.
Production deployment, production migrations and production replacement binaries
remain on hold. The installed CalorieBank beta is unchanged.

## Evidence and native correction

The separate synthetic diagnostic on Samsung SM-A136U / Android 13 showed:

| Measurement | Normal | 200% after Activity recreation |
| --- | --- | --- |
| Android and JS font scale | 1 | 2 |
| Native scaled density | 1.875 | 3.75 |
| React surface | 1 | 11 |
| Unchanged title: allocated / paragraph height, px | 66 / 66 | 66 / 246 |
| Unchanged Save: allocated / paragraph height, px | 46 / 46 | 46 / 251 |
| Newly changed calculation: allocated / paragraph height, px | — | 171 / 171 |
| Editor / memory draft | 150 / 150 | 100 / 150 |

The same JavaScript runtime and module memory survived. Native text scale updated;
unchanged paragraph layout allocations did not. Direct C++ cache-hit/layout-context
instrumentation was unavailable; cache causality is supported by the measured
unchanged-versus-changed text comparison and the pinned RN source, not a claimed
C++ runtime trace.

`with-fabric-font-scale.cjs` changes the Android application startup provider, not
individual Text views. It enables only `enableFontScaleChangesUpdatingLayout`.
The provider delegates all other methods to RN's existing stable Android provider.
`ReactSurfaceImpl` consequently passes `Configuration.fontScale` instead of `1f`
when creating/updating surface constraints. `SurfaceHandlerBinding` places it in
`LayoutContext.fontSizeMultiplier`; paragraph attributed text and the text measure
cache identity include that multiplier. This is layout invalidation, not extra
padding, a font-scaling cap, text remounting alone, or Activity-recreation suppression.

RN 0.81.5's public standard loader always installs its own provider. Calling a
second `override` is invalid. The plugin uses the pinned internal
`DefaultNewArchitectureEntryPoint.loadWithFeatureFlags` instead, retaining the
standard SoLoader initialization and edge-to-edge setup. Kotlin internal-access
suppression is explicit. The compiler warns that this is not a stable public Kotlin
API. RN version/signature guards fail prebuild on upgrades; review this integration
before changing RN. No React Native npm source patch or unrelated experimental flag
is applied. iOS startup is untouched.

Validation performed:
- Normal and isolated clean Android prebuild succeeded; the plugin is idempotent.
- The exact generated loader compiled with JDK 17 / Kotlin 2.1.20 against the
  published RN 0.81.5 release AAR, Android 13 API classes and SoLoader 0.12.1.
  This compiled loader classes only, not an APK or AAB.
- A JVM probe compared all 61 provider methods: only the font-scale flag differs.
- Expo native autolinking verification passed.
- Native source-path regressions cover surface scale, layout-context propagation
  and text cache identity. The measurement gate rejects the known clipped capture.

**Not yet proved:** corrected on-device paragraph dimensions, header/parent layout,
200% scrolling, keyboard/Save reachability and Android Back. Source checks and JVM
compilation are not physical geometry proof. Run
`node apps/mobile/scripts/validation/assert-font-geometry.cjs before.json after.json`
with normalized measured captures for title, Save and calculation. It requires
unchanged title/Save strings and compares allocated and actual paragraph heights in
physical pixels. No passing corrected native capture has been manufactured.

## Shared memory ownership

`session-drafts.ts` owns one current draft per non-destructive editor family outside
the React root. `use-editor-draft.ts` subscribes through `useSyncExternalStore`;
input handlers write synchronously so Activity teardown cannot race a deferred
persistence effect. There is no AsyncStorage, SecureStore, file, database or API
persistence. Process termination discards the module.

Each record contains context identity, starting revision/fingerprint, field values,
mode selections, input selection ranges and an in-flight save lock. Scope is the
verified Clerk user **and session**, with a generation token protecting late async
callbacks. Auth hydration does not mean sign-out. A confirmed session/account change
clears memory; account deletion explicitly terminates the draft session. The local
development scope is separate. Unmount alone never clears a valid draft.

| Editor | Values retained | Compatibility / revision |
| --- | --- | --- |
| Calorie correction | add/replace mode, both texts, selection | local date, source and selection revision; correction/manual revisions |
| Usual estimate / selection / Today estimate | text, selection | operation, date, selection revision, selected status; manual revision |
| Fitness Goal | goal mode, adjustment source, manual text, weekly rate, selection | onboarding/settings context; atomic setting revision |
| Daily Bank Target | text, selection | onboarding/settings context; atomic setting revision |
| Banking Goal | name, calories, both selections | atomic setting revision retained across delete/recreate; target date reviewed on conflict |
| Step Planning | burn target, steps target, both selections | local date, timezone, expenditure and step source |
| Account deletion | **excluded** | destructive confirmation remains component-local |

Step Planning inputs remain hypothetical; they have no Save and never write to the
API. Updated observations still recalculate results with unchanged approved formulas.

## Restoration, conflict and cleanup contract

Saved correction 100 plus unsaved draft 150 restores 150 after full root destruction;
the server remains 100 until explicit Save. Save and reset/remove retain existing
API semantics. The shared lock prevents duplicate in-flight saves across roots.
Successful Save or explicit Cancel clears the stored draft. Removing an editor from
the navigation stack (Back) also discards it. Onboarding Back clears its form draft;
a dirty onboarding form retains its presentation stage across recreation.

A compatible newer server revision does not replace draft text. Correction and
manual-estimate writes keep the existing server compare-and-set contract and reject
stale restored revisions. Updated settings forms use the opt-in atomic settings
contract below. Rejection preserves the draft and presents the latest committed
value. Explicit review rebases the expected revision; a separate Save is required.
Incompatible account/session/source/date contexts never apply the old draft.

Navigation state is also process/session scoped. It restores the existing stack,
selected tab and route parameters only after the existing authenticated startup
gate. It does not replace setup truth or force a navigator remount for font changes.
Deletion routes are not restored; confirmation text is never stored. Session reset
clears both navigation and drafts. A completed startup does not restore an old
onboarding route.

## Validation and remaining qualification

Rendered tests destroy the whole test root, then create a new root sharing module
memory. Coverage includes 150/100, both correction modes, Save/Cancel, account and
session changes, date/source/revision changes, fresh module discard, late-save
ownership, duplicate-save locking, all editable forms, navigation/tab restoration,
auth hydration and destructive-route exclusion. Existing iOS-style live-rerender
and tab-callback regressions remain required.

The shared `KeyboardSafeScrollView`, text styles, tab render callback and forecasting
math remain unchanged. Source/rendered review covers existing scroll ownership,
input inventory, result/action ordering and conflicts; it is not a physical visual
pass. Android must qualify corrected geometry, drafts, selected tab, keyboard,
Save and Back at 200%. iOS must regress shared draft/navigation behavior; its
previous physical pass belongs to build 15, not these changed sources.

An Android replacement binary is required for the native flag. Shared JavaScript
changes also require an updated iOS artifact to deliver this implementation to iOS;
there is no iOS-specific native fix. Neither artifact is created at this checkpoint.
Accounting, providers, permissions, authority, ledger and forecast calculations
are unchanged. The staged settings contract adds one concurrency-only migration.

## Initial local checkpoint (superseded by staged contract below)

- Focused regressions: **42 passed across 8 files**.
- Complete pinned Node 20 release gate: **1,081 passed across 104 files**, exit 0.
  Includes Prisma generation/validation, 39 existing migrations checked against
  the dedicated localhost test database, TypeScript, lint, domain/schema/API
  compilation and `git diff --check`.
- Online Expo dependency check: dependencies up to date. Native autolinking:
  verification passed. Public Expo config retains the same application identities,
  Fabric and permissions. Normal and isolated clean Android prebuild passed.
- Existing iOS-style mounted text-resizing and tab callback tests pass; physical
  iOS behavior of this shared draft/navigation implementation remains unqualified.
- HEAD remains `083f9955af0fed3f130fbb19ee37dfb9f37d1966`; all changes are local and
  uncommitted. No backend source, schema, migration, dependency lockfile, accounting
  code or provider code changed. No production records or installed apps changed.

Initial blockers at that checkpoint (atomic protection subsequently implemented below):
1. A positive corrected Android native-geometry capture has not been obtained.
   Loader compilation, flag comparison and rejecting the old failing capture do
   not prove corrected rendered bounds or reachable controls on Samsung.
2. Strict atomic conflict protection is unavailable on the existing Fitness Goal,
   Daily Bank Target and Banking Goal write contracts. Read-before-write detects
   already changed state but cannot prevent a concurrent mutation in the gap.
   Correction and manual-estimate endpoints retain their existing atomic revision
   checks. Extending backend mutation contracts was not silently added to this
   Android/local-draft correction.

The initial checkpoint was blocked by physical geometry and missing atomic
settings protection. The staged-contract section below records the subsequent
implementation; physical proof is still a separate gate.

## Affected files

Native/config:
- `apps/mobile/app.json`
- `apps/mobile/plugins/with-fabric-font-scale.cjs`
- `apps/mobile/scripts/validation/assert-font-geometry.cjs`

Shared state/navigation and hosts:
- `apps/mobile/lib/drafts/session-drafts.ts`
- `apps/mobile/lib/drafts/use-editor-draft.ts`
- `apps/mobile/lib/drafts/use-session-navigation.ts`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(onboarding)/onboarding.tsx`
- `apps/mobile/app/(settings)/daily-bank-target.tsx`
- `apps/mobile/app/(settings)/delete-account.tsx`
- `apps/mobile/app/(settings)/planned-treat.tsx`

Editors:
- `apps/mobile/components/caloriebank/DailyBankTargetForm.tsx`
- `apps/mobile/components/caloriebank/DailyBankTargetInput.tsx`
- `apps/mobile/components/caloriebank/GoalConfigurationForm.tsx`
- `apps/mobile/components/caloriebank/IntakeAdjustmentEditor.tsx`
- `apps/mobile/components/caloriebank/ManualEstimateEditor.tsx`
- `apps/mobile/components/caloriebank/StepPlanningCards.tsx`

Tests and documentation:
- `apps/api/tests/android-fabric-font-scale.test.ts`
- `apps/api/tests/session-draft-process.test.ts`
- `apps/api/tests/session-drafts.mobile.test.ts`
- `apps/api/tests/session-navigation.mobile.test.ts`
- `apps/api/tests/intake-adjustment.mobile.test.ts`
- `apps/api/tests/manual-intake.mobile.test.ts`
- `docs/engineering/keyboard-input-safety.md`
- `docs/engineering/android-font-scale-draft-restoration.md`

## Staged settings concurrency contract (October 15 follow-up)

Founder approved the explicit legacy-client limitation. Fitness Goal, Daily Bank
Target and Banking Goal retain their existing JSON request/response shapes.
Updated editors send `X-CB-Settings-Concurrency: 1`; reads return
`X-CB-Settings-Revision` and writes require a single quoted decimal `If-Match`.
Missing/malformed preconditions return 428. Stale preconditions return 409 with
`error.details.code = SETTINGS_CONFLICT`; the authenticated GET retrieves the
latest value/revision. Old clients send neither header and keep unconditional
writes. **Legacy editors remain vulnerable to stale overwrites.** No global
update requirement is introduced. Daily Bank Target's strict legacy response is
unchanged. Web CORS exposes the revision header.

The additive `settings_revisions` table keys a BIGINT counter by authenticated
user and setting. Absence is revision 0. A PostgreSQL transaction advisory lock
on user/setting serializes reads and all writes, including legacy writes. The
comparison, mutation and counter increment commit together at ReadCommitted.
Delete retains the counter, including repeated successful absent deletes;
recreation cannot reuse a previous revision. Failed mutations roll back. Account
deletion cascades these concurrency records. No accounting tables or formulas
are changed. Existing goal-change historical preparation is preserved; an
already-stale request is rejected before preparation and the final transaction
checks again. Normal preparation is not rolled back by a later competing edit.

Rollout requires the additive migration and completion of the API rollout on
**all** write-serving instances before distributing protected clients. An old API
instance cannot advance these counters. Protected clients fail closed if a server
omits the revision header; they never silently downgrade to unconditional writes.
No migration or backend deployment is authorized in this checkpoint.

Shared conflict UI retains text, modes, selections and the starting revision.
It shows the latest committed setting and requires explicit **Keep my edits**,
then a separate Save. Reviewing only rebases the draft's expected revision; it
never merges or writes. Another intervening write conflicts again. A remount
fetches the latest value and presents the same review if the dirty draft's
revision differs. Account/session/context invalidation and memory-only lifetime
remain unchanged. Banking Goal retry also refreshes the non-editable target-date
context after explicit review. Deletion confirmation remains excluded.

### Validation and isolated physical qualification checkpoint

- Node 20.20.2 final release gate: **1,106 tests / 107 files PASS**,
  TypeScript, lint, Prisma generation/validation, dedicated local migrations,
  domain/schema/API compilation and `git diff --check` passed.
- Focused settings protocol/repository/routes/draft checks: **43 tests PASS**.
- New tests: `settings-concurrency.persistence.test.ts` (15),
  `settings-concurrency.routes.test.ts` (2),
  `settings-concurrency.client.test.ts` (4), plus three explicit conflict/retry
  cases in `session-drafts.mobile.test.ts`. Existing editor mocks now exercise
  protected snapshot/revision contracts. Platform-neutral React tests do not
  constitute physical iOS or Android proof.
- One additive migration required: `20261016000000_settings_revisions`.
  Applied only to the dedicated localhost test database. Production untouched.
- Isolated diagnostic v2: `com.caloriebank.fontdiagnostic`, versionCode 2,
  EAS `96ba230c-d001-440b-be8c-787f49b5c644`. Source snapshot retained in the
  separate `/tmp/cb-font-diagnostic` repository as `395e853`. EAS submission
  began before that local snapshot commit, so its Git metadata reports parent
  `84c46a3`; the uploaded working files contain the correction. Production
  repository HEAD remains `083f995`, with uncommitted implementation work.
- Diagnostic prebuild, reachable-app TypeScript and Android bundle export passed.
  The native plugin is byte-identical to production's pending plugin (SHA256
  `7646a5c32bbd4c2ce5865cf4d6f6806aeac7085a3c8a68305e8f1747a5f0996f`).
  The shared store/navigation code is copied unchanged; the hook adds synthetic
  measurement logging only. Its API module is a memory-only synthetic stub,
  with no authentication/provider imports and Internet/health permissions blocked.
- Native instrumentation now reads the actual pinned ReactSurfaceImpl
  `getFontScale(context)` getter and enabled feature flag. This is the input
  used by `setLayoutConstraints`, not a direct read of C++ committed state.
  Paragraph MapBuffer serialization preserves non-finite values as diagnostic
  strings rather than failing the entire capture.
- Corrected physical geometry and the original saved-100/draft-150 sequence
  remain pending until the diagnostic is installed and measured. No production
  replacement binary, backend deployment or production migration was performed.

### Additional files for staged concurrency

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20261016000000_settings_revisions/migration.sql`
- `apps/api/src/modules/settings-concurrency/settings-concurrency.ts`
- `apps/api/src/modules/goal-configuration/goal-configuration.repository.ts` and `.routes.ts`
- `apps/api/src/modules/daily-bank-target/daily-bank-target.repository.ts` and `.routes.ts`
- `apps/api/src/modules/planned-treat/planned-treat.repository.ts` and `.routes.ts`
- `apps/api/src/app.ts` (exposed response header only)
- `apps/mobile/lib/api/client.ts` (exports existing authenticated request boundary)
- `apps/mobile/lib/api/settings-concurrency.ts`
- `apps/mobile/lib/drafts/use-settings-conflict.ts`
- `apps/mobile/components/caloriebank/SettingsConflictNotice.tsx`
- `apps/api/tests/settings-concurrency.persistence.test.ts`
- `apps/api/tests/settings-concurrency.routes.test.ts`
- `apps/api/tests/settings-concurrency.client.test.ts`
- Updated protected-client fixtures in `banking-goal-load-recovery.test.ts`,
  `keyboard-safety.mobile.test.ts`, `onboarding-journeys.test.ts`,
  `phase-one-presentation.test.ts`, and `session-drafts.mobile.test.ts`.

The existing editor/draft files listed above are also updated for the protected
contract. Dependency manifests and lockfiles remain unchanged.

### Installed diagnostic and final gate

Diagnostic EAS job finished; exactly one v2 APK was created and installed on the
Samsung SM-A136U / Android 13. APK SHA256:
`32cfa7a7d2459382937ea61645e46cef25fa5b9a913890121c5f6893ef917680`.
Manifest verifies `com.caloriebank.fontdiagnostic`, versionCode 2, no Internet or
Health Connect permissions, and unchanged Activity configuration handling.
CalorieBank package versionCode remains 15 before/after installation.

The final gate passes **1,106 tests / 107 files** with `VITEST_MAX_WORKERS=2`.
Two earlier unrestricted reruns encountered an existing identity test socket
hang-up and an existing reconciliation test's five-second timeout respectively.
Both passed targeted rechecks; worker bounding changes no assertions, timeouts or
within-test concurrent requests. The final full gate exits 0. An additional
regression prevents conflict-preview values crossing sessions even if the React
component remains mounted.

At the physical handoff the phone is locked (`mDreamingLockscreen=true`), the
diagnostic process is running, and the founder has been asked to unlock/open the
synthetic editor and confirm saved value 100. No corrected 200% geometry or
150/100 physical pass is claimed yet. Production backend/database/binaries remain
unchanged.


### Physical diagnostic qualification — October 15, 2026

The pending physical checkpoint above is now superseded by measured results on
Samsung SM-A136U / Android 13, isolated diagnostic versionCode 2. No production
binary or backend was changed.

At 20:22:52 UTC, system font scale changed from 1.0 to 2.0. Activity identity
changed from 182736507 to 88446566 and Fabric surface ID from 1 to 11. React
context 227990800 and JS runtime 1792093867523-0.93348657487117 survived. The
React root unmounted/remounted; shared module memory retained the unsaved draft.
Android configuration, PixelRatio, window dimensions, shared provider and the
pinned Fabric layout-input getter all reported 2.0 after the transition. The
feature flag was true before and after. Scaled density changed 1.875 to 3.75.
Fabric paragraph text attributes also changed their font-size multiplier to 2.

| Text | Normal allocated / paragraph px | 200% allocated / paragraph px |
| --- | --- | --- |
| Unchanged title | 66 / 66 | 246 / 246 |
| Unchanged Save label | 46 / 46 | 91 / 91 |
| Calculation, unchanged 150 input | 46 / 46 | 171 / 171 |

Captures 6 and 11 from the v2 process were normalized and passed the existing
`assert-font-geometry.cjs` native measurement gate. These are physical paragraph
and view measurements, not simulated React rerenders. Direct C++ committed
constraints and per-span glyph outlines are not exposed; the layout-input getter,
serialized paragraph multiplier and measured allocated/paragraph agreement are
the evidence. The founder independently confirmed readable, unclipped text.

The original scenario passed: saved 100, unsaved 150, Activity recreation,
restored editor 150, synthetic committed value still 100/revision 0/saves 0.
The founder confirmed input, calculation and Save reachable by scrolling with
the keyboard open at 200%. Cancel and reopening returned 100; the subsequent
editor log retained saved 100/revision 0/saves 0. Explicit Save once at
20:26:57.417 UTC recorded saved 150/revision 1/saves 1, and reopening at
20:26:59.544 UTC confirmed those same values. No automatic save occurred.

Raw synthetic evidence is retained outside Git under
`/tmp/cb-font-diagnostic-v2-{draft150,scale200,keyboard200,cancel200,save200}`
(logs/decoded JSON where applicable); normalized geometry is
`/tmp/cb-font-v2-geometry-{before,after}.json`. These temporary evidence files
must be archived if long-term retention is needed.

The isolated Android geometry/draft blocker is resolved. Full production-app
physical qualification, including shared changes on iOS, remains a later private
release step. Automated iOS/shared regressions passed; this diagnostic is not
physical proof for iOS or every production editor. Legacy unconditional settings
writes remain explicitly outside universal stale-write protection. Migration
and complete backend rollout must precede protected clients.

Verdict: PHASE 2A ACCESSIBILITY CORRECTION: READY FOR PRIVATE RELEASE QUALIFICATION.
Implementation remains uncommitted on the production repository at 083f995.
No production migration, backend deployment or production replacement build was
performed during this qualification.
