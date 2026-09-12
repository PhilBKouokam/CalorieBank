# Android B1 foundation

B3 implements the Android exact-package nutrition consumer path and additive server source identity. Fitbit remains the qualified Android burn path; direct FatSecret remains available; Health Connect burn stays disabled. The [B3 build and qualification record](../deployment/android-preview.md) is authoritative for build delivery, emulator results, physical QA and deployment status. Earlier phase records below are historical baselines.

Implemented 2026-09-11. Scope: shared direct-provider path and platform safety. Canonical plan: [Android parity plan](../product/android-parity-plan.md). This is source/configuration qualification, not Android physical certification or release authorization.

## B2 follow-up — 2026-09-11

B2 adds the read-only qualification bridge described in [Android Health Connect](android-health-connect.md). The B1 findings below remain the baseline: native source selection is still disabled, now explicitly because it is **not qualified**. Android has seven read-only Health Connect permissions and a beta diagnostic path; iOS/direct providers/accounting remain unchanged. Burn and walking calibration remain unqualified. Isolated native project generation passes, but no native compile/startup or real-device qualification was possible, so no remote preview was created. See the new guide for the pinned dependency patch, validations, physical script and exact B3 work.

## Platform boundary

`apps/mobile/lib/native-health/index.ios.ts` directly aliases the existing Apple Health functions. Querying, account scope, persistence, sync windows, retry policy and normalized ingestion remain unchanged. `index.android.ts` and the non-native fallback expose a typed `not_implemented` capability, unavailable connection state, no writers, null refresh/diagnostics, and a rejecting sync method. No fabricated zeros, success, permissions or Health Connect connection exist.

Shared layout, lifecycle, onboarding, Connections and History use this facade. Existing neutral API/domain contracts remain intact. The facade's type-only references reuse the existing adapter signature; B2 should refine native provider types only as required by a qualified Health Connect adapter. Do not introduce a second bank engine.

The original HealthKit diagnostic screen moved byte-for-byte to `apps/mobile/screens/health-diagnostics.ios.tsx`; the shared route reexports the platform-resolved screen. Android redirects that route to Connections. A route-level `.android.tsx` alone was insufficient: Expo Router also included the base route's native imports. The non-route platform boundary removes those imports from Android's bundle. Android also resolves a no-op `FoodTrackerHelp.android.tsx`.

The exact FatSecret writer-preference helper moved unchanged to `lib/providers/intake-writer-policy.ts`, with the old export preserved. A relative API-client import in `healthkit-connection.ts` allows its signatures to be checked by both workspaces without relying on the mobile-only alias. No HealthKit implementation behavior changed.

## Temporary B1 behavior

Android offers direct Fitbit for Calories Burned and direct FatSecret for Calories Eaten. Native-health connection choices and management/help paths are hidden. No coming-soon card is necessary. This is temporary B1 behavior, not final Android product design.

A selected source saved on another device remains selected on the server. Connections presents it as “Source on another device” with attention needed; it never silently switches authority. Incomplete setup resumes at an explicit direct-source choice instead of entering an impossible device-health preparation attempt. Existing direct services remain connected. Completed accounts retain their existing bank/history and can explicitly change sources in Connections. Historical provenance is retained; consumer labels do not misidentify Apple records as Health Connect. Historical exact-date source changes still use stored server data and the existing eligibility rules.

iOS retains the same native choices, source semantics and copy. Step Planning layout, forecast math, Available Bank, Recovery, Banking Goal, Fitness Goal, Daily Bank Target, finalized records, Opening Bank, ledger and server lifecycle are unchanged.

## Configuration and branding

- Android package and unchanged iOS bundle ID: `com.caloriebank.mobile`. Separate platform namespaces do not conflict. Existing Expo project ID remains unchanged; no credentials/resources were registered.
- App name: CalorieBank. Existing `caloriebank` scheme and Router configuration remain shared. Explicit provider callback: `caloriebank://integrations`.
- Installed Clerk plugin supplies Android `clerk://com.caloriebank.mobile.hosted-callback`. Auth diagnostic display now reflects this; the iOS diagnostic URL remains `com.caloriebank.mobile://callback`. Actual Clerk session activation and redirect handling are unchanged.
- Existing canonical `icon.png` serves launcher/splash; white background, green CB mark. Android adaptive foreground, white background and monochrome mask replace Expo artwork. `apps/mobile/scripts/android-branding.cjs` reproduces them deterministically from the unchanged canonical asset using the already installed image utility.
- No Health Connect permission or dependency. Block unused microphone, legacy external-storage and overlay permissions introduced by defaults/dependencies. Network and notification functionality remain. Expo introspection is not the final Gradle merged manifest; inspect that during native qualification.
- Existing edge-to-edge setting retained. Insets, keyboard, gesture back and accessibility still require native device QA.
- Preview profile explicitly specifies Android APK. Production remains the existing profile (default Android store AAB behavior); no Play submission profile/resource was created. Do not use the iOS-oriented `testflight` profile for Android.
- Existing public environment handling remains; no secret or production Clerk change. HTTPS API URLs are required for device testing; `localhost` on a phone is the phone itself.

## Direct providers and authentication

Clerk provider, secure token cache, authentication gate, sign-in/sign-up, restore, sign-out, account cleanup and verified API credential resolution stay shared. Diagnostic URL selection is the only auth change. Android exports include Clerk's native Android module and platform callback. Live hosted-auth return/session restoration require device testing; source/config tests do not certify the production dashboard allowlist.

Fitbit and FatSecret keep the existing `openAuthSessionAsync` browser flow, common provider return URI, server-owned authorization attempts, expiring/single-use callback binding, encrypted token persistence, refresh and disconnect paths. No server/provider code or priority rules changed. Fitbit still uses direct Google Health/Fitbit total-calories, steps and activity evidence. FatSecret still uses delegated OAuth 1.0 diary totals, never Health Connect. Existing empty/missing diary, account isolation and role-selection tests remain authoritative.

Live Android browser launch, warm/cold callback, cancel/back, reconnect/disconnect and account switching are not yet certified. Custom-scheme callback parameters never establish account identity; authenticated server state does. Verify both providers on a real phone in the later preview milestone.

## Notifications

`ensureMorningUpdateChannel` creates the default Android channel before permission/token registration and is a no-op on iOS. It does not prompt on startup. The channel matches unchanged server payload behavior. Android permission recovery says “Android Settings”; iOS copy and the existing native notification Settings opener remain unchanged. Existing token ownership, logout/deletion detach, lifecycle serialization and notification taps are retained.

FCM resources/credentials and Google services configuration were not created. Android push delivery is unqualified until those resources are explicitly authorized and a native build is tested. Server morning window, timezone, copy, delivery deduplication, retries and invalidation are unchanged. Retain the Phase A unknown-send-outcome risk; B1 does not claim exactly-once OS delivery.

## Change size

Eight of the 35 pre-B1 route/component files (about 23%) needed platform guards, copy selection or a diagnostic/help boundary; the app layout additionally changed only its facade import. There are no screen redesigns. This is a file-count estimate, not 23% duplicated UI: the existing screens remain shared, and only the native diagnostic/help implementations use platform-specific screen/component files.

## Validation evidence

Using pinned Node 20.20.2:

- Full `release:friends-family` gate passed: Prisma validation, existing migrations into a newly created dedicated **local test database**, workspace TypeScript (including mobile/API), mobile lint, 699 tests in 59 files, API build, `git diff --check`.
- Full workspace `npm test` also passed (same 699 tests; workspace scripts route calculation/schema regressions through API tests). Lint has one pre-existing `today.tsx:270` exhaustive-deps warning and zero errors.
- Added six facade/config/source-policy tests, two channel tests and four Android rendered journey tests. Existing iOS onboarding combinations and provider ownership/reconciliation/notification/account deletion suites pass. Static route tests follow the moved iOS diagnostic screen and neutral names.
- `expo config --type introspect --json` resolves both platforms. iOS config and generated iOS mods compare identical to the pre-B1 snapshot. Android package, intent filters and adaptive assets resolve. No Health Connect declarations.
- `expo install --check` with online metadata: dependencies up to date. No dependencies installed or SDK upgraded.
- Expo Android autolinking and React Native config resolve. Neither includes HealthKit nor the iOS-only local notification-settings module. Clerk Android is present.
- Production JavaScript/Hermes exports for Android and iOS pass (web export also passes). Android source maps contain neither HealthKit runtime nor Apple ingestion adapter; iOS resolves the original adapter and platform diagnostic screen. These are local exports, not native binaries or EAS builds.
- Visual review: canonical-derived adaptive foreground inspected; synthetic rendered component fixtures inspected for activity choice, food choice and Connections at narrow 320/360 px content widths. These HTML proxies check copy/hierarchy/wrapping, not native typography, icon rendering, safe areas, keyboard, touch or OS behavior. No consumer stylesheet or Step Planning presentation was changed. Full native visual/accessibility QA remains required.

Initial test runs failed because the sandbox denied local sockets and the default local database lacked recent migrations. Those failures were resolved using an isolated test database, never migrating the existing database or production. An intermediate TypeScript failure from the newly exercised mobile alias was fixed with the relative import described above.

No JDK or Android SDK is installed in this environment, so no local Gradle/native compile or emulator run was performed. No physical Android or iOS QA was performed. Passing B1 means ready for the next implementation phase, not release-ready.

## Next task: B2 native evidence gate

Implement the bounded Health Connect capability/native bridge and qualification work in the canonical plan. First verify records/origins, permission/history availability, completed local-day coverage, and exact-origin evidence on supported Android versions. Use fixture tests before server ingestion. Preserve direct providers, iOS behavior and all accounting. Qualify full-total burn before enabling it; never assume total or resting rate records imply complete daily expenditure. Pair walk/run steps and energy using defensible evidence; omit unsupported estimates.

Defer actual production-ready normalized ingestion, persisted exact-package intake authority, onboarding discovery/preparation, permission recovery and provider UI to the relevant B2/B3/B4 scope in the plan. B1 does not add `health_connect` server identity or schemas. Do not squeeze those changes into an Android facade patch.

Later real-phone gate: Fitbit + direct FatSecret first; hosted auth restore/sign-out/account switch; both warm/cold provider callbacks; empty/missing history; explicit source switching; bounded Opening Bank preparation; Today/history/forecast and locked Step Planning; foreground refresh; notifications (with authorized FCM); deletion; small screens, font scaling, keyboard, insets, accessibility and OEM back behavior. Then add the three Health Connect combinations in the plan once qualified. No remote preview until the authorized useful B2/B3 health-data milestone unless a concrete blocker proves it necessary.

## B1 file inventory

This commit also includes the canonical Phase A audit document and its documentation links prepared immediately before B1.

- `apps/api/tests/android-foundation.test.ts`
- `apps/api/tests/android-notification-channel.test.ts`
- `apps/api/tests/consumer-routes.test.ts`
- `apps/api/tests/health-connection-release.test.ts`
- `apps/api/tests/onboarding-journeys.test.ts`
- `apps/api/vitest.config.ts`
- `apps/mobile/README.md`
- `apps/mobile/app.json`
- `apps/mobile/app/(auth)/sign-in.tsx`
- `apps/mobile/app/(details)/bank-history.tsx`
- `apps/mobile/app/(onboarding)/onboarding.tsx`
- `apps/mobile/app/(settings)/delete-account.tsx`
- `apps/mobile/app/(settings)/health-diagnostics.tsx`
- `apps/mobile/app/(settings)/integrations.tsx`
- `apps/mobile/app/(settings)/morning-bank-update.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/assets/images/android-icon-background.png`
- `apps/mobile/assets/images/android-icon-foreground.png`
- `apps/mobile/assets/images/android-icon-monochrome.png`
- `apps/mobile/components/caloriebank/FoodTrackerHelp.android.tsx`
- `apps/mobile/eas.json`
- `apps/mobile/lib/auth/platform-redirect.ts`
- `apps/mobile/lib/healthkit/apple-health-intake-writers.ts`
- `apps/mobile/lib/healthkit/healthkit-connection.ts`
- `apps/mobile/lib/lifecycle/account-lifecycle.ts`
- `apps/mobile/lib/native-health/copy.android.ts`
- `apps/mobile/lib/native-health/copy.ts`
- `apps/mobile/lib/native-health/index.android.ts`
- `apps/mobile/lib/native-health/index.ios.ts`
- `apps/mobile/lib/native-health/index.ts`
- `apps/mobile/lib/native-health/presentation.ts`
- `apps/mobile/lib/native-health/types.ts`
- `apps/mobile/lib/native-health/unavailable.ts`
- `apps/mobile/lib/notifications/android-channel.ts`
- `apps/mobile/lib/notifications/morning-bank-update.ts`
- `apps/mobile/lib/providers/intake-writer-policy.ts`
- `apps/mobile/lib/providers/presentation.ts`
- `apps/mobile/lib/today/presentation.ts`
- `apps/mobile/screens/health-diagnostics.ios.tsx`
- `apps/mobile/screens/health-diagnostics.tsx`
- `apps/mobile/scripts/android-branding.cjs`
- `docs/engineering/android-foundation.md`
- `docs/product/android-parity-plan.md`
- `docs/product/v1-prd.md`
