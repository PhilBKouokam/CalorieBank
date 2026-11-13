# Isolated release-baseline presentation extraction

Base: verified deployed API commit ba09e402ea78016c2223eb4364de9a2f489ae237.
Presentation source: e4a363441b93ac02c3e3d166c1e71528356984b4, later UI delta after b3d4d22.

This is a partial local integration candidate, NOT a full redesign delivery or a shipping artifact.

## Extracted and checked

Common frosted surfaces, theme, settings/onboarding/detail wrappers, goal/editor presentation components, screenshot-sharing prompt/policy/native adapter, and reusable metric materials. Dependency manifest/lockfile includes expo-blur, expo-screen-capture, expo-sharing and react-native-view-shot. Ordinary Expo entrypoint, EAS profiles, app IDs, config, API clients, backend, schemas, domain and migrations remain exactly at baseline.

Screenshot sharing adds capability only; no screenshot was captured/shared by this preparation. Native confirmation/behavior must be qualified on both platforms before distribution.

## Explicitly retained baseline overlaps

Eight conflicting files were restored to baseline rather than importing newer behavior:
- app/(details)/bank-history.tsx
- app/(settings)/edit-calories.tsx
- app/(tabs)/settings.tsx
- app/(tabs)/today.tsx
- components/caloriebank/EatingPlanPanel.tsx
- components/caloriebank/IntakeAdjustmentEditor.tsx
- components/caloriebank/StepPlanningCards.tsx
- components/caloriebank/WalkingEatingCard.tsx

Those overlaps mix design with historical-edit navigation, account refactoring, reserve exposure, local eating-scenario behavior and newer walking helpers. Today sticky header and Fitness Goal relocation are therefore NOT integrated in this subset. Reusable metric components are present but not wired into baseline Today. Emergency Reserve page/component were excluded. Synthetic qualification code, fixes and config were excluded.

Two straightforward presentation conflicts (detail route title and Today-burn frosted wrappers) were resolved explicitly. No merge conflict markers remain.

## Fresh qualification

Node20.20.2 local domain/schema compilation and mobile TypeScript checks pass. Workspace dependencies are bound to this worktree's own domain/schema outputs, avoiding newer source contamination.

55 tests pass in5 files: frosted-surface.mobile, screenshot-sharing.mobile, today-metric-material.mobile, today-steps-card.mobile, health-connection-release. Diff whitespace check passes. API runtime, Prisma, domain/schema, EAS profile, ordinary app config and API-client diff against baseline is empty.

No remote action, deployment, native build, migration, billing, credential or production setting change. Existing dirty main checkout and recovered source were preserved.

## Next integration work

Port overlapping screens one at a time with baseline contract fixtures. Separate purely visual layout from newly introduced guidance/scenario/reserve behavior; do not resolve overlaps by wholesale taking newer source. Then run the full baseline regression gate and native iPhone/Android qualification with explicitly reconciled profile flags. This subset alone does not meet all-page parity or public-release readiness.

## Follow-up integration completed — 12 November

The eight overlapping files listed above now have reviewed presentation ports. Their earlier baseline-only status is superseded by this section.

- Today uses the qualified responsive activity rail, measured sticky-header threshold and keyboard unpin behavior. Fitness Goal no longer appears as a Today card; the existing Settings route remains available. Other Today lifecycle, data-fetch, account and guidance gates remain baseline.
- History now uses the redesigned single-title/balance treatment, signed semantic colors and responsive day rows. Range selection, detail loading, missing-data explanation, source-choice cancellation and exact-date source change remain existing behavior. New historical-calorie pencil/navigation is deliberately not imported because the baseline editor does not accept its date route contract.
- Settings and planning/editor panels received frosted wrappers and matching styles without importing reserve exposure, account-auth refactoring, revised walking models or the newer local deficit/banking scenario calculation.
- Current-day calorie editing retains the baseline save API and draft/conflict behavior. Planning retains the baseline readiness, expiry and request ownership semantics.

Fresh combined gate: **138 tests passed in15 suites**, including rendered History/source changes, responsive detail layouts, sticky rail/keyboard release, startup lifecycle and failed reads, account/draft isolation, inverse/forward planning, editor saves, screenshot sharing, materials and native permission policy. Existing behavioral assertions were kept; three test mocks were extended for newly-used native visual/keyboard APIs. Mobile TypeScript and scoped ESLint both pass without warnings/errors. Diff whitespace check passes.

Verified empty diff against ba09e402 for backend runtime, Prisma, domain/schema/config packages, Expo/EAS configuration, API clients and draft ownership code. No synthetic entry/transport/config was introduced.

Remaining qualification: actual on-device rendering/scroll/blur/keyboard/accessibility/share checks for this full-app candidate, frozen cloud environment flags, whole-release regression gate and store readiness. This is not pixel-identical to the synthetic candidate's newer planning/scenario flows; those behavior changes require a separately reviewed contract-compatible integration. No public release or build occurred.

## Whole-release and local bundle qualification — 12 November

The repository release:friends-family wrapper completed with exit0 on Node20.20.2:
- Prisma client generation and schema validation passed using worktree-private generated output.
- All40 baseline migrations applied to a newly created dedicated localhost database. No existing or remote database was used.
- All workspace typechecks and lint passed; domain/schema/API compilation and diff whitespace checks passed.
- **1,442 tests passed across141 suites;2 migration-audit tests remained intentionally skipped** behind the existing explicit DDL-audit guard. No guard was disabled or relaxed.

Full-gate discoveries were addressed in test scaffolding: missing existing daily-intake-adjustment fixture delegate, native visual/keyboard mocks, the established dynamic-import boundary for mobile hook tests and obsolete pre-redesign color/component-tag assertions. Calculation, source ownership, persistence, lifecycle and account assertions remain. The initial rc-named test database was rejected by several stricter persistence guards; a second fresh test-named local database was used instead of changing those guards.

Local offline bundle export also found a real platform boundary: web was statically importing native screenshot capture dependencies despite being unsupported. Added native-screenshot.web.ts returning null plus an explicit regression. iOS/Android screenshot code remains unchanged.

Verified **offline exports for all platforms** succeeded: Android Hermes bundle (1,862 modules), iOS Hermes bundle (1,925 modules), web bundle and47 static routes. Inert .invalid API/auth fixture settings were used; nothing was authenticated, published or uploaded. Installed dependencies were copied locally with APFS copy-on-write to remove an initial symlink resolution limitation. Temporary Metro configuration was removed. These exports are compiler evidence, not signed native apps, device tests or release-config qualification.

Evidence logs:
- /private/tmp/caloriebank-whole-release-gate-20261112-final.log
- /private/tmp/caloriebank-release-web-export-final.log
- /private/tmp/caloriebank-release-all-bundles.log
Local non-shipping exports: /private/tmp/caloriebank-release-all-bundles-20261112.

Disposable PostgreSQL cluster /private/tmp/caloriebank-release-gate-pg-20261112 is stopped (verified no server running). No production/server settings, credentials, live data, shared source or paid services changed. Backend, Prisma, shared runtime packages, API clients, draft ownership, Expo/EAS profiles and ordinary app IDs still match ba09e402.

Remaining boundaries: full-app physical-device QA; cloud configuration/signing and approved private artifacts; store/privacy/rights/reviewer gates. Screenshot prompt supports iOS and Android API34+; the previously used Samsung API33 device cannot qualify the prompt. No native installation or paid build was attempted.

## Signed private build attempt — 13 November

The owner approved up to $3 of existing Expo credit for one medium iOS/Android pair. Live billing before submission showed $10/$45 used ($35 remaining); medium Android was $1/build and medium iOS $2/build. No plan, billing or public distribution change was made.

Build profile preflight preserved ordinary IDs and existing beta API/Clerk auth. Both profiles explicitly enable Eating Budget, disable Health Connect qualification and local HTTP, pin Node20.20.2 and use medium workers. App config was converted to equivalent compiler-independent JavaScript after reproducing a missing-TypeScript loader failure. Focused policy tests and mobile typecheck passed. These changes are commit3d0537b.

- iOS23: 967a1a58-9cf3-4c10-8aaa-d8d614d0293e, testflight profile, store-signed IPA target. Submitted with the intended config changes still uncommitted because a preceding git command used the wrong working directory. EAS therefore records4720247 with a dirty marker, not clean3d0537b. Cloud Read eas.json confirms the intended flags and Node version. Credential preparation, prebuild, pods and JS bundle passed; native compilation was underway at this entry.
- Android22: d923fa2a-97c5-46b7-8746-17e79c798091, play-testing profile, store AAB target, clean3d0537b source. Still building at this entry.

Neither artifact has been submitted to a store, installed or qualified on a device. The builds are not a public release.

Post-submit dependency audit found expo-screen-capture declares READ_MEDIA_IMAGES for Android13, despite the app deliberately enabling screenshot prompts only on iOS and Android34+. This is an unnecessary merged-permission risk and a distribution hold until the built manifest is inspected. Commitce32939 explicitly blocks it;23 focused tests across3 suites pass. That fix is NOT included in Android22. No replacement build was started. Expo billing explains automatic waivers only for failures within3 minutes; the current job exceeded that duration, so a free replacement cannot be assumed.

### Artifact and private delivery results

- iOS23 finished2026-11-13T04:54:52.930Z. IPA inspected locally: com.caloriebank.mobile1.0.0(23), iOS17 minimum, arbitrary loadsfalse, OTA updatesfalse, store provisioning (no ad-hoc device list, get-task-allowfalse), HealthKit entitlementtrue; profile expires2027-08-13. SHA256:7799952c0c9f19bae5e987738ef053a26b6672db8b189ce0d1d0e18f46c8f7c3.
- Authorized private TestFlight upload succeeded, submission7651756a-1cb3-4a40-b184-04f4fec19dd1. Apple's05:09:39UTC email confirms1.0.0(23) available to test. Device app query still showed installed22; no23 device QA claimed.
- Android22 finished2026-11-13T05:12:32.464Z. AAB downloaded and protobuf merged manifest inspected: ordinary com.caloriebank.mobile1.0.0(22), minSDK26,targetSDK36, READ_NUTRITION as sole health permission. SHA256:a33e15bb747853c6c187cb33989a1071df94f6ada9f35c1eebf77204ecb9bd55.
- Android merged manifest DOES contain unnecessary READ_MEDIA_IMAGES with min/maxSDK33. Distribution remains held. Local Expo introspection ofce32939 confirms an explicit tools:node=remove entry for that permission. A corrected cloud build would need separate credit authorization beyond the original$3 pair. No retry initiated.
- Mac reconnected, but iPhone Mirroring reports Mac locked and automatic unlock failed. UI installation/QA waits for manual Mac unlock. No public release, tester-list changes or device overwrite occurred.
