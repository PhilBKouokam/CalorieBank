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
