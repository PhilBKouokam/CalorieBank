# Android Phase A: Platform Parity and Architecture Audit

Latest B3 auth retest: production email-code sign-in and session restoration succeed,
but the Android hosted callback reproducibly opens Expo Router's Unmatched Route.
Sign-out succeeds; protected Today loads after relaunch. No code or replacement
build was created. See the [callback defect record](../deployment/android-preview.md#observed-authenticated-callback-defect--2026-09-12)
for the narrowly scoped next fix and remaining physical QA.

2026-09-12 auth update: the existing production Clerk instance now registers Android
`com.caloriebank.mobile` and exact callback `clerk://com.caloriebank.mobile.hosted-callback`.
iOS registration/callback and production keys are preserved. The existing B3 APK is
reused; no replacement build or product-code change. See the [auth verification record](../deployment/android-preview.md#production-clerk-android-registration--2026-09-12)
for actual test results and remaining account/physical qualification.

B3 implements the Android exact-package nutrition consumer path and additive server source identity. Fitbit remains the qualified Android burn path; direct FatSecret remains available; Health Connect burn stays disabled. The [B3 build and qualification record](../deployment/android-preview.md) is authoritative for build delivery, emulator results, physical QA and deployment status. Earlier phase records below are historical baselines.

Audit date: 2026-09-11. Status: **ANDROID PHASE A AUDIT: READY FOR IMPLEMENTATION**.

This verdict means a bounded foundation phase can begin when authorized. It does not mean Android is built, tested, release-ready, or that every Health Connect writer is qualified. Health Connect burn and estimator support have explicit evidence gates below. This document records proposals, not changes to accepted accounting or permission to deploy.

## B2 implementation update — 2026-09-11

**ANDROID PHASE B2: PASS — HEALTH CONNECT BURN REMAINS UNQUALIFIED**.

The Android facade now includes a read-only Health Connect qualification service using pinned `react-native-health-connect` 4.1.3. Seven read permissions, exact-package discovery/isolation, revision-aware pagination, an eight-date window, mutation/permission/account-generation checks and beta diagnostics are implemented. A checked Android-only patch preserves nullable nutrition energy. The app-specific permission-rationale activity is generated correctly. Normal provider selection, production ingestion, accounting and forecast use remain disabled for Health Connect.

See [Android Health Connect qualification](../engineering/android-health-connect.md) for the dependency assessment, native patch, record/permission matrix, normalization policies, **NOT QUALIFIED** burn verdict, physical script and exact B3 work. Nutrition/steps are conditionally usable evidence; walking calibration is withheld because session energy/step association is unproven. Empty or ambiguous evidence never becomes a manufactured zero.

Android prebuild succeeds in an isolated temporary project; Android/iOS JavaScript exports and autolinking resolve. iOS generated configuration remains identical to B1, and no direct-provider, backend, schema or bank logic changed. There is no local JDK/SDK/ADB, so native compilation, Android startup and physical qualification remain unperformed. The conditional preview milestone is therefore unmet: **no EAS Android build**, no Play release, no iOS/TestFlight build and no Render deployment.

Validation: the complete release gate passed with **732 tests in 62 files**, workspace/API/mobile TypeScript, lint (one existing Today warning), Prisma checks against the dedicated local test database and API build. Both platform exports, dependency validation, autolinking, isolated prebuild, iOS baseline comparison and local documentation links passed. Native compile/physical QA were not performed.

B3 must begin with native compile/startup and physical evidence validation, then add qualified exact-origin intake Connections/onboarding and additive server ingestion/source contracts. Do not infer production readiness from a successful prebuild, test fixture or populated total-energy interval.

## B1 implementation update — 2026-09-11

**ANDROID PHASE B1: PASS — READY FOR HEALTH CONNECT IMPLEMENTATION** (source/configuration qualification; physical release gate outstanding).

The foundation and direct-provider phase is implemented. See [Android foundation](../engineering/android-foundation.md) for exact files, behavior, validation and remaining gates. Android now resolves a capability-safe native-health facade, hides unavailable native source paths, preserves server authority across devices, uses CB adaptive artwork and package `com.caloriebank.mobile`, and retains direct Fitbit/FatSecret plus shared Clerk/navigation/API flows. iOS aliases the original adapter. No Health Connect ingestion, backend/domain/schema change, deployment or EAS build was made. Local JavaScript exports are not native builds.

B1 includes the minimum default notification channel/copy work originally listed under B5; FCM and physical notification qualification remain deferred. All subsequent capability/release gates below remain in force. The original Phase A findings below are a dated baseline, not claims that B1 is still unimplemented.

## Authority and audit boundary

The current iOS Friends & Family/TestFlight product is the canonical experience. [V1 PRD](v1-prd.md), [bank calculation specification](bank-calculation-spec.md), [Phase 1 pre-Android contract](phase-1-pre-android.md), and [Step Target Forecast Stability](step-target-forecast-stability.md) remain authoritative. In particular, the current **Banking Goal** is the limited rename of Planned Treat, not the deferred ADR 013 allocation system. Daily Bank Target is planning metadata, not Fitness Goal and not an accounting input.

Reviewed the active `apps/mobile` route/component/library inventory, native module and Expo/EAS configuration, shared provider/schema boundaries, and related API provider, lifecycle, bank, identity and notification paths. `backups/mobile-sdk57-backup` and `legacy` are not Android starting points. Repository inspection is not verification of the installed TestFlight binary; before physical comparison, record its build number and matching commit. No production account, service dashboard, wearable data, or installed Android runtime was accessed.

The working tree was clean at audit start. Phase A changed documentation only; the B1 update above records the subsequent authorized implementation. It does not implement Android, alter iOS behavior, change accounting, migrate data, register resources, deploy, submit, or create an Android build.

Related contracts: [provider-neutral ingestion](adr-006-provider-neutral-ingestion-architecture.md), [source authority](adr-016-authoritative-provider-selection-and-multi-provider-resolution.md), [wearable qualification](adr-017-multi-provider-wearable-integration-strategy.md), [direct nutrition](adr-018-direct-nutrition-provider-strategy-and-fatsecret-integration.md), [identity](adr-019-beta-identity-and-environment-boundary.md), [Opening Bank](adr-020-opening-bank-and-recovery-presentation.md), [step contribution](adr-021-personalized-step-contribution-and-initial-visibility.md), [Apple intake writer](adr-022-apple-health-intake-writer-authority.md), [resting burn](adr-023-resting-burn-intelligence.md), [historical authority](adr-024-provider-aware-historical-day-authority.md), and [Morning Bank Update](adr-024-morning-bank-update.md). The two existing ADR 024 filenames address different subjects; use full links.

## Readiness and reuse estimate

The product is structurally suitable for Android, but Android readiness is incomplete. React Native screens and server read models already do most of the work. The main migration is device health, source provenance, platform permissions and release configuration, rather than a new UI or bank engine.

A source inventory counted 62 TypeScript/TSX files including configuration and the generated Expo declaration, approximately 10,352 lines; 2,342 lines are in `lib/healthkit`. This is a rough implementation-size denominator, excluding dependencies, generated native projects, assets and the small Swift module. Some health-directory utilities are reusable, while some screen code outside that directory is Apple-specific.

Estimate **75–85% of current mobile implementation can remain shared or be reused with small boundary changes**, and over 90% of screen structure should remain shared. This is not a measured compatibility rate or an effort estimate. HealthKit native code is not portable; notification/settings glue and configuration require Android work. Existing accounting formulas and finalized record semantics should be reused in full. Server ingestion and source-selection plumbing require additive support for a new provider.

### Architecture classification

Paths below are relative to `apps/mobile` unless otherwise identified. Categories may overlap: A neutral; B easily abstractable iOS coupling; C HealthKit; D notification/settings; E permissions/config; F signing/distribution; G genuine Android work; H unresolved compatibility/risk.

| Surface and current files | Class | Finding and planned treatment |
| --- | --- | --- |
| `app/_layout.tsx`, `app/index.tsx`, every route-group `_layout.tsx` | A/B/H | Expo Router 6 Stack/Tabs, auth gates and account-keyed remounts are shared. Root directly sets Apple account scope. Inject native-health scope; test Android back, modal dismissal, resume and cold links. |
| `app/(auth)/sign-in.tsx`, `lib/auth/hosted-auth-diagnostics.ts` | A/B/E/H | Clerk hosted auth and session activation are shared. Diagnostic redirect currently reads `ios.bundleIdentifier`; derive Android diagnostics from package without inventing a new auth flow. Actual `startHostedAuth` chooses its native callback. |
| `lib/api/client.ts` | A/B | Fetch, credential readiness, Zod boundaries, generation checks and error handling are shared. `shouldSyncHealthKit` and device schemas need an additive neutral contract. No provider secrets belong here. |
| `app/(onboarding)/onboarding.tsx`, `lib/onboarding/*` | A/B/C/G | Journey and persisted completion truth are shared. Apple choice, writer discovery, initial-import plan and readiness checks need native capability substitution. Keep Daily Bank Target stage and bounded preparation. |
| `app/(tabs)/today.tsx`, `lib/today/*`, `SummaryCard`, `CompletedContribution` | A/B | Server bank and Today models, Recovery, goal card, Today so far, explanations and refresh UI stay shared. Platform-aware source presentation only. |
| `StepPlanningCards`, `app/(details)/steps-detail.tsx`, `today-burn.tsx`, `today-workouts.tsx` | A/H | Domain estimates, walking time, existing readiness and locked visual hierarchy stay shared. Android data qualification and keyboard/font wrapping need proof. |
| `app/(details)/bank-history.tsx`, `app/(tabs)/history.tsx` | A/B/C | Tab re-exports detail screen. History, explanation, missing-day retry and provisional source picker are shared; retry directly calls Apple refresh with an eight-day window and needs native dispatch. |
| `GoalConfigurationForm`, `DailyBankTargetForm`, `DailyBankTargetInput`, goal/target settings | A/B/H | Keep signed Fitness Goal semantics and target neutrality. Android IME, focus/select-all, keyboard avoidance and large text need QA. |
| `app/(settings)/planned-treat.tsx`, `customize-today.tsx`, `app/(tabs)/settings.tsx` | A | Preserve current Banking Goal/Planned Treat persistence and customization; do not add allocation banks, meals or spending. |
| `app/(settings)/delete-account.tsx`, sign-out in Settings | A/B | Existing server deletion and token-detach sequence are shared. Deletion copy explicitly says Apple Health/iOS; substitute Android permission-management text. |
| `app/(settings)/integrations.tsx`, `FoodTrackerHelp`, `lib/providers/presentation.ts` | A/B/C/G | Role-first screen, explicit source mutations and browser direct providers are reusable. Local Apple composition, tracker help, management and source names need Android implementations. |
| `lib/healthkit/apple-health-provider.ts`, `apple-health-intake-writers.ts`, `dietary-energy-source-diagnostic.ts` | C/G | Native HealthKit reads and exact bundle lookup remain iOS. Android needs Health Connect record queries, package origins and energy qualification. |
| `lib/healthkit/healthkit-connection.ts` | B/C/G | 913-line adapter owns account-scoped storage, outbox, single flight, session evidence, uploads, history and resting estimate. Extract only orchestration needed by both; preserve Apple query behavior. |
| `lib/healthkit/rolling-sync-policy.ts`, `source-operation.ts`, `connection-feedback.ts`, `fatsecret-feedback.ts` | A/B | Reuse ordered retries, operation gates and feedback. Upload key currently embeds `apple_health`; parameterize provider and source identity before reuse. File location does not make FatSecret native. |
| `lib/lifecycle/account-lifecycle.ts` | A/B/C | Shared scope generations and serialized foreground work; direct Apple imports/status and server flag are coupling points. Device health remains foreground-owned. |
| `lib/healthkit/health-connections-presentation.ts`, `food-tracker-guidance.ts` | B/C/G | Separate local permission truth from server authority. Do not apply iOS empty-read permission inference or writer names to Android. |
| `app/(settings)/health-diagnostics.tsx`, HealthKit diagnostic helpers | B/C/G | Optional beta diagnostics include Apple-specific details; share neutral query/outbox/session reporting, retain native detail separately. |
| `lib/notifications/*`, `app/(settings)/morning-bank-update.tsx` | A/D/G | Existing token registration accepts Android. Missing channel initialization; settings recovery currently falls back to app settings. Preserve account operations. |
| `modules/notification-settings/*` | D/F/G | Expo module declares only `apple`; Swift opens iOS 16 notification settings. Android-specific settings intent is needed for direct parity; keep Swift unchanged. |
| `app.json`, `app.config.ts`, `eas.json`, `package.json` | E/F/G/H | SDK 54/RN 0.81.5/New Architecture/Node 20 pinned. No Android package or Firebase config. Existing profiles mostly express iOS distribution. |
| `assets/images/*`, `constants/caloriebank-theme.ts`, icons | A/E/G/H | Shared CB icon/theme are reusable. Visual inspection found blue Expo artwork in Android foreground icon; it is not the CB mark. Prepare Android adaptive/themed assets from existing identity. |
| `app/(modals)/ledger.tsx`, `PlaceholderScreen.tsx` | A | Ledger modal is a placeholder, not an on-device ledger engine. Do not turn it into a new Android feature. |
| Declared Expo Symbols, haptics, image, fonts, gestures, safe-area, Reanimated/Nitro dependencies | A/H | Screen icons primarily use Ionicons. Audit Android autolinking/New Architecture in a development binary; dependency presence alone is not runtime proof. No SDK upgrade is justified by this audit. |

The older mobile README contains a stale statement that notifications are deferred. Current notification code and accepted Morning Bank Update ADR supersede that statement; the document link update removes this ambiguity without changing behavior.

## Verified Android capabilities and limitations

Official sources were checked on the audit date. “Verified” below describes an API or vendor-documented behavior, not successful CalorieBank device testing.

### Platform and Expo boundary

Health Connect is device-local. Android 14+ includes it as a system component; older supported phones use its app. Runtime support requires Android 9/API 28+ with Google Play services, while the Jetpack client can be included on API 26+. Check SDK availability and feature availability separately. Unsupported/update-required devices must still be able to use direct Fitbit + FatSecret. Proposed initial supported Android baseline: API 28+; validate the final dependency minimum before committing it. [Android availability](https://developer.android.com/health-and-fitness/health-connect/availability), [setup](https://developer.android.com/health-and-fitness/health-connect/get-started).

SDK 54 already targets Android 16/API 36 and uses edge-to-edge layout. Stay on pinned Node 20 and Expo 54; do not use the SDK 57 backup. A native development binary is required for Health Connect and Android remote push; Expo Go is not the test environment. [SDK 54 release](https://expo.dev/changelog/sdk-54), [SDK 54 notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

Health Connect's first-party API is Jetpack/Kotlin. A community bridge, `react-native-health-connect`, is a candidate, not an installed or certified dependency. Its current v4 documentation includes its Expo integration and deprecates the separate `expo-health-connect` package. First try a pinned bridge version in an isolated compatibility spike; verify origin filters, metadata, pagination, permission results, availability and aggregate semantics on SDK 54/New Architecture. Use a small local Expo Kotlin module only for missing required primitives, or if the bridge cannot meet the contract. Do not copy old bridge documentation's Play approval timelines as current policy. [Bridge maintainer documentation](https://matinzd.github.io/react-native-health-connect/docs/get-started/).

### Data mapping

| Needed input | Android API evidence | CalorieBank decision / qualification gate |
| --- | --- | --- |
| Total daily expenditure | `TotalCaloriesBurnedRecord`, aggregate `ENERGY_TOTAL` | Candidate `FULL_TOTAL` only for a verified writer exporting full local-day expenditure including rest. An interval total or non-null aggregate alone does not establish completeness. Never add active, steps or workouts to this total. |
| Active energy | `ActiveCaloriesBurnedRecord`, `ACTIVE_CALORIES_TOTAL` | Can support workout evidence and a qualified decomposition. Active-only is never a banking total. |
| Resting component | `BasalMetabolicRateRecord`, `BASAL_CALORIES_TOTAL` | BMR is a rate, not a HealthKit-style stream of basal energy. Do not silently multiply the last rate by 24 or accept platform fallback estimates as measured writer history. `DERIVABLE_TOTAL` needs documented same-origin rate integration, coverage and overlap policy before banking. |
| Steps | `StepsRecord`, `COUNT_TOTAL` | Use exact selected activity origin and aggregate API; do not manually sum overlapping intervals or include another phone/wearable source. |
| Exercise | `ExerciseSessionRecord` with type/start/end and optional segments/laps | Session existence does not guarantee calorie/step samples. Normalize workouts without fabricating absent values. Routes, GPS, heart rate and write access are unnecessary. |
| Walking/running calibration | Same-origin session plus interval steps and **active** energy | Only join evidence when duration, pause/overlap semantics and record coverage are defensible. Daily totals are not workout evidence. Preserve latest up-to-five valid walk/run samples; one can qualify calories/step. |
| Walking time | Walking-only steps and valid active duration | Preserve current 2–5 sample pace method. Session wall-clock duration containing pauses is not automatically the existing active-duration measure. |
| Intake | `NutritionRecord.energy`, aggregate `ENERGY_TOTAL` | One exact selected package. Null energy, no records and explicit zero are distinct. Import normalized calorie totals only, not food entries. |
| Provenance | `metadata.dataOrigin.packageName`, optional device data | Package is writer identity. Device metadata is optional and writer-supplied; it does not prove original wearable ownership. |
| Revisions | Metadata ID, `lastModifiedTime`, optional client ID/version; Changes API | Preserve retrieval time separately from record time. Source modification time is not “observed through now.” Requeries must see deletes as well as upserts. |

API references: [record types and permissions](https://developer.android.com/health-and-fitness/health-connect/data-types), [aggregation and exact-origin filtering](https://developer.android.com/health-and-fitness/health-connect/aggregate-data), [metadata](https://developer.android.com/health-and-fitness/health-connect/data-format), [synchronization and deletions](https://developer.android.com/health-and-fitness/health-connect/sync-data), [exercise integration example](https://developer.android.google.cn/codelabs/health-connect?authuser=01&hl=en). The proposed qualification rules are CalorieBank design constraints, not promises made by those APIs.

Health Connect priority/deduplication behavior is not CalorieBank authority. Always specify the chosen origin. Never trust a combined Health Connect display total as one provider. An app that republishes another app's records is the visible writer; Health Connect does not guarantee the upstream tracker identity can be recovered. Future Health Connect burn support must therefore qualify a writer, not globally declare every `health_connect` source `FULL_TOTAL`.

### Discovery, permissions and historical import

Discover intake candidates from readable `NutritionRecord` origins over a bounded window, with complete pagination; resolve a package label when available and retain the package as the stable identity. A discovered writer is not necessarily currently installed or still exporting. An installed app is not necessarily a writer. Do not request broad installed-app visibility or infer a tracker's Health Connect permissions from our own permission state.

The current experimental [Matchmaking API](https://developer.android.com/health-and-fitness/health-connect/ui/matchmaking) can help users connect compatible writers before samples exist, but requires granted read permissions, feature checks and experimental opt-in. It is optional future connection assistance, not the V1 authority/discovery foundation and not proof that data was imported. A normal source-empty path must work without it.

Health Connect exposes granted read permissions, unlike HealthKit's deliberately opaque read-denial behavior. Check permissions before each read and on resume; distinguish unavailable, install/update required, permission denied, granted-but-empty, query failure and stale data. An empty query must not be labeled denied. Keep the selected package when permissions are revoked or samples disappear; require explicit switching and never fall back to all origins.

By default, reads reach 30 days before the initial permission grant. Seven-day Opening Bank preparation fits this limit **if the writer actually exported those dates**. A tracker may have older history in its own cloud that it has never written locally. Requesting history permission does not create it. Check feature availability and obtain `READ_HEALTH_DATA_HISTORY` only when the existing prediction history needs dates outside the permitted interval. The iOS resting estimator currently tries 14, 30 and 90 days, so 90-day forecast evidence is not automatic Android parity. Use defensible shorter history when available; denial must not prevent Opening Bank or direct-provider setup. [Read restrictions](https://developer.android.com/health-and-fitness/health-connect/read-data).

Preparation must record a deliberate result for every required date/category and exact source in the seven-day import window, including empty/error. Resume persisted attempts after interruption. Today's partial total is never evidence that yesterday was queried after midnight. Normal rolling foreground work retains Today plus the prior two local dates; bounded catch-up and the History retry window must remain explicit exceptions, not accidental full-history resync.

For Today, capture a single query cutoff, account/source generation, local timezone and sync session. Aggregate burn and steps with that cutoff, independently record category outcomes and only expose the existing planning-ready condition when matching accepted rows belong to the same terminal session/source. Health Connect does not provide a cross-record-type atomic snapshot guarantee. If relevant records change during acquisition, invalidate/retry the bounded snapshot rather than silently combine generations. Keep observed-through time and record revisions separate; a fresh query cannot make an old writer export current. Reuse existing expiration, no smoothing and server repeatable-read behavior.

Start with full bounded-window requery plus normalized fingerprints/outbox: this naturally handles deletions in provisional dates without maintaining a second local health database. Changes tokens are optional optimization; they expire after 30 days of non-use, and deletion events expose only IDs. If introduced, partition by record type/source/account and recover by bounded requery. Neither record deletion nor token expiry permits rewriting a locked day.

## Fitbit and food providers

### Existing direct Fitbit integration

`apps/api/src/modules/google-health/google-health.service.ts` owns Google Health OAuth, PKCE/state attempts, initiator binding, token exchange, encrypted server token persistence, refresh and bounded category sync. `google-health.provider.ts` normalizes `total-calories`, steps and exercise metrics under `google_health_fitbit`. Exercise normalization reads optional calories, steps, distance, active duration and update time. Missing exercise metrics already remain null. Server lifecycle remains readable while either mobile app is closed.

The API callback remains the configured `GOOGLE_HEALTH_REDIRECT_URI`; `google-health.routes.ts` redirects back to `caloriebank://integrations` with the outcome. Mobile onboarding and integrations use `WebBrowser.openAuthSessionAsync`; redirect validation only accepts that scheme/host with optional query. Android needs its registered intent filter and reliable Custom Tabs return, including onboarding context, cancellation, process death and account switch. Do not replace the server OAuth client with an Android Google Sign-In client or put Fitbit refresh credentials into SecureStore.

Account ownership comes from verified API credentials and the server attempt, not redirect query parameters. A callback must not silently select a source for a different signed-in account. Existing connection and role-change policies remain shared. Expected direct Fitbit reuse: nearly all server/provider code and most mobile flow. No Fitbit code changed in this audit. Repository inspection verifies implementation structure, not live token validity or dashboard callback allowlists.

Clerk authentication is a separate browser flow. The installed source uses hosted auth, Clerk token cache and `useAuth` session confirmation. Register the eventual Android package/native application in the correct Clerk instance and verify callbacks for development, preview and Play signing. Do not assume the Fitbit scheme also handles Clerk. [Clerk/Expo guidance](https://docs.expo.dev/guides/using-clerk/), [SDK 54/55 compatibility guidance](https://clerk.com/articles/clerk-compatibility-in-expo-54-and-55), [Expo browser authentication](https://docs.expo.dev/guides/authentication/).

### Verified integration distinctions

| App/service | Direct CalorieBank integration | Health Connect evidence | Android release position |
| --- | --- | --- | --- |
| Fitbit / Google Health | Existing server `google_health_fitbit`; burn, steps, exercise | Google documents Health Connect sharing and write-permission configuration; not proof of every metric's completeness | Prefer direct integration for initial Android. Independently qualify any mediated burn path; never sum direct and mediated Fitbit. [Google help](https://support.google.com/googlehealth/answer/14506680?hl=en) |
| FatSecret | Existing delegated OAuth 1.0 diary-total integration | Android nutrition export/package identity not established in this audit | Keep direct path; do not advertise mediated FatSecret until verified. OAuth 2 client credentials are not diary authorization. |
| Cronometer | None | Official guide explicitly lists Food/Water nutrition export | Documented mediated intake candidate; device-test exact origin, edits and historical backfill before claiming CalorieBank support. [Cronometer](https://support.cronometer.com/hc/en-us/articles/22731903751316-Health-Connect) |
| MyFitnessPal | None | Official guide says calories eaten are exported as meal summaries | Documented mediated intake candidate; do not expect individual foods or add exercise adjustments to consumed calories. [MyFitnessPal](https://support.myfitnesspal.com/hc/en-us/articles/10553948248973-Health-Connect-FAQ-and-Troubleshooting) |
| Lose It! | None | Official July 2026 guide lists nutrition export, including calories; also manual steps/workouts | Documented mediated intake candidate. Manual activity export is not evidence of qualified full expenditure. [Lose It!](https://loseit.zendesk.com/hc/en-us/articles/47650100219028-Using-Health-Connect-With-Lose-It) |
| MacroFactor | None | Official integration chart was inspected visually and explicitly marks Health Connect Read Nutrition and Write Nutrition as Yes | Documented mediated intake candidate; exact package, energy records, edits and backfill still need physical qualification. [MacroFactor integrations and chart](https://help.macrofactorapp.com/en/articles/102-integrations), [setup](https://help.macrofactorapp.com/en/articles/65-connect-health-connect-apple-health-or-fitbit) |
| Other compatible apps / Samsung Health | No new direct integration in scope | Health Connect compatibility alone does not establish data type, provenance or full daily burn | Discover observed origins truthfully; qualify each claimed capability. No blanket supported-provider list. |
| Garmin / WHOOP | Deferred under existing policy | Any platform compatibility is separate from CalorieBank qualification | Remain deferred; Android does not authorize advertising or enabling them. |

The Google help search result was available, but a subsequent full-page fetch was rate-limited; no detailed Fitbit-to-Health-Connect record-type guarantee is inferred from it. Vendor documentation does not verify today's user's app version, subscription tier, export delay, editing semantics or backfill.

### One intake authority on Android

Persist `health_connect` plus one selected writer package, separately from `fatsecret`. All reads, uploads, selection fingerprints and historical evidence retain this identity. Reuse the role-first Calories Eaten UI and explicit switching. Never overload the Apple bundle field with an Android package or infer Android package IDs from iOS IDs.

For direct-plus-mediated duplicates, use verified product/package mapping only for presentation preference, mirroring current direct FatSecret preference. Keep one selected transport; do not merge matching calories, automatically transfer authority, or discard an explicitly selected source merely because another connection exists. Unknown identity means distinct alternatives, not guessed duplicates. The same rule applies to direct Fitbit versus a Fitbit-writing Health Connect app.

Connected-but-empty remains connected with no usable data. Missing energy is unavailable, not zero intake. A successful source switch changes only its selected role, leaves other services connected and preserves inactive identity. Reconcile eligible provisional dates only using persisted exact-date source evidence; locked and Opening Bank dates remain immutable. Backfill and source-change retries use source-scoped fingerprints so an old outbox cannot overwrite a newer selection. On another phone, an unavailable selected device source is shown honestly; Android cannot read an iPhone's HealthKit history and must not silently replace it.

## Accounting firewall and existing audit flags

Android will use the same server-authoritative `FinalizedDailyBankRecord`, immutable ledger, Opening Bank snapshots and reconciliation engine. It does not receive permission to post a balance or supply an alternative adjustment factor. Preserve:

- Exactly one expenditure authority and one intake authority per completed date, including valid historical overrides.
- Provider expenditure × 0.80 and the existing signed Fitness Goal calculation; Daily Bank Target and forecasts remain neutral.
- Available Bank = max(0, effective balance); Recovery = max(0, -effective balance); neither clamps the ledger.
- One-time Opening Bank from the most-recent contiguous eligible positive-sum suffix, at most seven prior completed dates, only after both roles' full-window attempt. No matching suffix means zero with no opening rows; pre-opening dates never post again.
- Immediate provisional posting after completed-day proof, two-local-day append-only reconciliation and permanent locking; goal changes settle bounded recoverable days under the old goal or reject recoverably.
- Immediate existing finalization orchestration after successful authoritative ingestion, and identical hourly server-readable lifecycle behavior.
- Banking Goal progress uses non-negative Available Bank and is zero during Recovery; it is not an allocation ledger.

No mobile path was found creating authoritative finalized records or ledger entries. `StepPlanningCards.tsx` calls domain forecast and walking-time functions on-device; `apple-health-provider.ts` normalizes health totals and estimates resting burn; Today formats bank results. These are ingestion/prediction/presentation work, not an on-device bank engine. The legacy-named ledger modal is a placeholder.

Existing issues to retain as explicit flags, not fix in this audit:

1. `packages/schemas/src/index.ts` admits only `apple_health` for device ingestion and resting-estimate inputs; banking/intake enums exclude Health Connect. `today-ingestion.routes.ts` hardcodes Apple provider attribution. Uploading Android values there unchanged would mislabel provenance.
2. `ProviderSelection` stores Apple-specific writer fields, and aggregate uniqueness is currently user/date/provider. Android exact-origin history needs additive origin-aware evidence storage; one mutable per-provider row cannot preserve several historical writer choices. Do not change existing Apple rows or accepted historical behavior as a shortcut.
3. Apple workout normalization currently supplies `totalSteps: null`, while calibration/pace require paired steps. The existence of Step Planning screens is not proof all current iOS source combinations produce estimates. Preserve honest availability; do not invent Android values to achieve visual parity.
4. Morning Update ADR says unknown send outcomes must not be automatically resubmitted, but the current Expo transport classifies a caught network failure as retryable. An accepted request followed by a lost response is an ambiguity risk. Android must not expand retries; any correction is a separate reviewed shared-service task with explicit authorization, not part of this audit or a silent Android behavior change.

## Minimum abstraction and exact implementation boundaries

Reuse `ExpenditureProvider`, `IntakeProvider`, `StepProvider`, `WorkoutProvider` and existing normalized models in `packages/domain/src/index.ts`. Add no new accounting interface. Introduce a small mobile `NativeHealthBridge` facade for availability, granted permissions, authorization, settings, origin discovery, account scope, bounded sync and diagnostics. Provider capability/qualification remains explicit.

Proposed files (not created in Phase A):

| Proposed seam | Files / implementation responsibility |
| --- | --- |
| Shared native-health contract | `apps/mobile/lib/native-health/types.ts`: role/capability availability, exact source identity, query outcome, time window and sync evidence. Keep UI copy outside native modules. |
| Platform facade | `apps/mobile/lib/native-health/index.ios.ts` delegates to existing Apple functions unchanged; `index.android.ts` delegates to Health Connect; `index.ts` or web fallback returns unsupported. Avoid eager HealthKit imports in Android. |
| Android adapter | `apps/mobile/lib/health-connect/health-connect-provider.ts`, `health-connect-connection.ts`, `health-connect-origins.ts`: implement existing normalized provider interfaces and source-scoped reads. Native SDK calls isolated here. |
| Optional native supplement | `apps/mobile/modules/health-connect/` only if the evaluated bridge lacks required capability. Kotlin has only device API work, no bank logic. Do not build two competing bridges. |
| Shared orchestration | Extract bounded sync/outbox pieces from `lib/healthkit/rolling-sync-policy.ts` and `healthkit-connection.ts` into `lib/native-health/` only when both callers need them. Preserve Apple storage keys/migration and cooldown/session behavior. |
| Shared callers | Replace native-health calls in root layout, onboarding/recovery/bootstrap, integrations, lifecycle and History retry; retain route/component hierarchy. Source-operation gates and Today read hook remain shared. |
| Presentation | Generalize local health-connections composition and `lib/providers/presentation.ts`; add Android tracker guidance. Keep Apple-specific diagnostics and known bundle mappings intact. |
| Notifications | Keep `notification-operations.ts`; Android initialization in `morning-bank-update.ts` and a settings platform helper or Android extension to the existing local module. Swift remains unchanged. |

Required future server/schema work is **ingestion plumbing**, not accounting redesign:

- `packages/domain/src/index.ts`: additive Health Connect identifier/capabilities without provider-name branching in bank math; expenditure authority requires a qualified origin.
- `packages/schemas/src/index.ts` and `source-state.ts`: validated provider/origin/time evidence, device lifecycle directive and source options. Retain current Apple request/response compatibility.
- `apps/api/prisma/schema.prisma` plus a reviewed additive migration: persist Android selected origin independently for burn/activity and intake, inactive origin identity, and exact-date origin evidence for historical selection. Define uniqueness/fingerprints by account/provider/origin/date/category where evidence requires it. Extend current historical authority structures instead of making a parallel selection truth.
- `apps/api/src/modules/today/{today-ingestion.routes,sync-session.routes,sync-session.repository,today.repository,today.service,today.bootstrap,provider-catalog}.ts`: accept validated Health Connect data, preserve native provider identity and source-scoped session ownership, and expose identical normalized read models.
- `apps/api/src/modules/provider-selection/*`, `onboarding/*`, `bank-history/day-source-authority.ts`, `bank-history/opening-bank-import.ts`, `lifecycle/account-lifecycle.routes.ts` and `.service.ts`: add device-provider eligibility/selection/import evidence. Keep `shouldSyncHealthKit` for existing iOS clients and add a neutral directive for new Android clients; do not reinterpret the old flag silently.
- Existing finalization orchestration remains the only posting path. Regression fixtures must establish equal finalized results for equal normalized inputs, with no migration rewriting accounting.

Before enabling Health Connect burn, record an Android-specific extension to ADR 017/022 covering qualified writer identity, total/derived semantics and historical origin persistence. An unknown writer remains unavailable for banking until qualified. This is a prerequisite within implementation, not a reason to delay the direct-provider foundation.

## Product parity matrix

“Full” means identical product semantics using equal qualified inputs, not identical OS dialogs or a guarantee of sensor data. All rows describe planned Android work, not completed implementation. Phone QA is required for release even where fixtures can verify logic.

| Feature | Current iOS implementation | Proposed Android implementation | Shared code | Android-specific work | Parity / risk | Physical QA |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication | Clerk hosted auth, token cache, server identity | Same | Yes | Package/callback/browser verification | Full / medium | Sign-in/up, cancel, kill/resume, token restoration |
| Onboarding | Persisted journey with Apple/direct connections | Same stages with HC/direct choices | Mostly | Native availability, source selection | Semantic / high | Fresh/restart/interrupted setup |
| Burn-source selection | Apple Health or direct Fitbit | Qualified HC origin or direct Fitbit | Mostly | HC origin qualification and permission composition | Conditional / high | Two writers, unavailable selected source |
| Food-source selection | Exact Apple writer or FatSecret | Exact HC package or FatSecret | Mostly | Discovery, permission and empty states | Semantic / high | Every advertised tracker |
| Fitness Goal | Shared signed-goal form/API | Same | Yes | IME/layout QA | Full / low | Cut/maintain/bulk, change failure |
| Daily Bank Target | Separate planning metadata/settings | Same | Yes | IME/layout QA | Full / low | Zero/default/edit/resume; unchanged bank |
| Preparation | Deliberate two-role import attempt | Same normalized date evidence | Mostly | Native HC window and interrupted reads | Semantic / high | Complete/partial/empty seven-day window |
| Opening Bank | Server immutable initialization | Same server engine | Yes | Qualified source input only | Full / high input risk | Positive suffix, no match, restart, no duplication |
| Available Bank | Read-only server balance opens History | Same | Yes | Layout QA | Full / low | Uncalculated/zero/positive/large values |
| Recovery | Server-derived negative-balance presentation | Same | Yes | None beyond QA | Full / low | Enter/exit; goal progress zero |
| Banking Goal | Renamed Planned Treat card/settings | Same limited feature | Yes | None beyond QA | Full / low | Create/edit/progress during Recovery |
| Today so far | Burn/intake context and detail | Same normalized Today model | Mostly | HC freshness/source labels | Conditional / high | Delayed writer, missing one category |
| Steps | Selected source count, visibility, contribution | Same | Mostly | HC exact-origin steps and evidence | Conditional / high | Phone+watch duplicates, first visibility |
| Step Planning | Locked two-card domain projections | Same equations/cards | Yes | Evidence joins and coherent snapshots | Conditional / high | Same-input stability, mixed generation, keyboard |
| Walking-time estimates | Walking-only pace model | Same | Yes | Valid duration/steps evidence | Conditional / high | Pauses, missing pace, 25-minute sessions |
| History | Unified opening/later days and detail | Same | Mostly | Native retry and exact origin options | Full with qualified data / high | Locked/opening/provisional source changes |
| Morning Bank Update | Server Expo/APNs notification | Same server via Expo/FCM | Mostly | Channel, permission, FCM | Semantic / medium-high | Real push, morning/DST/late-data cases |
| Notification settings | App preference + iOS permission/deep link | App preference + Android app/channel state | Mostly | Channel-aware settings/denial recovery | OS difference / medium | Deny, revoke, channel off, reopen |
| Foreground refresh | Shared server run + Apple rolling sync | Shared server run + HC rolling sync | Mostly | Adapter and neutral directive | Semantic / high | Concurrent resumes, process death, offline |
| Settings | Shared role-first links and controls | Same | Yes | Native management destinations/copy | Semantic / low | Back stack and TalkBack |
| Sign out | Detach token before Clerk sign-out | Same | Yes | Android race QA | Full / high privacy impact | Failed detachment; account B on same phone |
| Account deletion | Server revocation/Clerk/cascade workflow | Same | Mostly | HC permission-management copy | Full / high privacy impact | Retry, pending deletion, app restart |
| Burn/workout details and Why 80% | Current shared explanations | Same source-truthful detail | Yes | Labels, HC empty evidence | Semantic / medium | Dialog, scroll, reader focus |
| Customize Today | Persisted optional card choices | Same | Yes | None beyond QA | Full / low | Explicit choice never overridden |
| Historical source change | Exact date/role, provisional-only | Same with persisted HC origin evidence | Mostly | Additive evidence schema | Full / high | Other dates/role/locked values unchanged |
| Diagnostics | Beta API and HealthKit query reporting | Shared report + HC diagnostic detail | Partly | Permission/origin/query metadata | Operational / medium | Redaction, no cross-account data |
| App icon/splash/navigation/accessibility | Current CB icon, shared RN UI | CB adaptive/themed icon and native Android chrome | Mostly | Assets, insets, back, TalkBack | Platform visual adaptation / medium | Launcher masks, splash, narrow/large text |
| Planning Database / advanced allocation / ledger modal | Broader PRD scope; no complete current mobile Planning Database route; allocation deferred; ledger placeholder | No new feature introduced for parity | Existing only | None | Preserve current scope | Confirm no accidental new entry points |

## Notifications: preserve server semantics

Keep the 07:00–11:59 persisted-IANA-timezone hourly window, DST conversion, yesterday eligibility, positive/banked, negative/enjoyed and zero/on-target copy, and positive-only title celebration. Notification failure never affects the bank. Device health may not reach the server until the app is foregrounded; if yesterday becomes ready after the window, no stale morning push is created. This applies to Health Connect just as to foreground-only HealthKit.

The existing guarantee is one durable delivery decision per account/completed date and no intentional resend after an accepted Expo ticket, **not guaranteed exactly-once OS delivery**. Preserve bounded known-failure retries, receipt checks after 15 minutes and token invalidation. Retain the network-ambiguity audit flag above. See the [accepted ADR](adr-024-morning-bank-update.md).

Android-specific requirements:

- Configure FCM v1 credentials in EAS and the matching Firebase Android app configuration; no service-account secrets in `EXPO_PUBLIC_*` or source. `getExpoPushTokenAsync` already uses the EAS project ID and registration accepts `platform: android`.
- Create the Android channel before requesting permission/acquiring a token. Android 13+ needs runtime notification permission. The current code calls permission/token APIs without channel setup.
- Prefer a stable `default` channel whose visible name is “Morning Bank Update” for the first slice: the existing server payload omits `channelId`, and Expo documents the default channel. Verify arrival on that exact channel in a real build. If a named custom channel is necessary, add Android-only routing metadata later, without changing delivery eligibility or iOS payload behavior. [Expo sending behavior](https://docs.expo.dev/push-notifications/sending-notifications/).
- Expose app preference separately from OS/channel permission. A disabled channel can suppress delivery despite app permission; inspect that state. Use `ACTION_APP_NOTIFICATION_SETTINGS` with package extra, optionally channel settings, and an app-settings fallback. Do not use iOS URL strings.
- Preserve root tap routing to Today after authentication; test warm/cold taps, stale notification responses, sign-out and account changes. Notification data is navigation context, never authority to read another account.
- Re-register on authenticated resume/token changes and invalidate `DeviceNotRegistered` through existing ticket/receipt handling. Test uninstall/reinstall and token replacement. Release token association before sign-out; failed release stays recoverable and signed in. Deletion removes registration through the current workflow.

Android OS scheduling, Doze, offline delivery and user channel choices can delay/suppress display. Do not introduce alarms, a second scheduler or background health reads to conceal those differences. [SDK 54 notification permissions/channels](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/), [FCM v1 setup](https://docs.expo.dev/push-notifications/fcm-credentials/).

## Android app configuration proposal

| Configuration | Proposal / current gap |
| --- | --- |
| Android package | `com.caloriebank.mobile`: matches the product's reverse-domain identity, simplifies callback diagnostics and is independent of Apple's namespace. Not registered/availability-checked. If simultaneous beta/prod installation later requires suffixes, treat that as a separate environment decision with separate callbacks/FCM entries. |
| iOS identity | Keep `com.caloriebank.mobile` unchanged; no signing, plist, entitlement or TestFlight changes. |
| App name | CalorieBank, shared existing identity. |
| Icon | Adapt existing green CB mark to foreground safe zone, matching background and monochrome mask; replace Expo Android artwork only. Check circular/squircle/themed launchers. |
| Splash | Reuse current CB artwork/background through existing splash plugin; verify Android system splash crop and dark mode physically. |
| SDK/minimum | Keep SDK 54/RN 0.81.5, target/compile API 36; propose API 28 minimum, confirm bridge minimum. Keep New Architecture. No cross-platform upgrade. |
| Permissions | Read-only `READ_TOTAL_CALORIES_BURNED`, `READ_ACTIVE_CALORIES_BURNED`, `READ_STEPS`, `READ_EXERCISE`, `READ_NUTRITION`; add `READ_BASAL_METABOLIC_RATE` only for the justified qualified resting/derived path and `READ_HEALTH_DATA_HISTORY` only for approved longer prediction history. Request by selected role. `POST_NOTIFICATIONS` is separate. No writes, background health, routes/location, body sensors or exact alarms. |
| Health Connect manifest | Availability package query for `com.google.android.apps.healthdata`, required permission-rationale/privacy-policy activity and Android 14+ permission-usage alias. Route system onboarding entry to the existing persisted journey. Verify exported/protected activity settings against the selected SDK/plugin. |
| OAuth links | Preserve `caloriebank://integrations` BROWSABLE/DEFAULT VIEW handling. Clerk's native callback comes from its plugin/package configuration; verify merged manifest and corresponding Clerk native app registration. Do not invent HTTPS app links without domain ownership/configuration. |
| Notifications | Expo notifications plugin plus stable Android channel and appropriate monochrome small notification icon; Firebase Android client file/config, FCM v1 secret on EAS only. |
| Development networking | Existing local HTTP toggle is iOS-only. Prefer HTTPS for Android; if local HTTP is required, confine any cleartext exception to development. Emulator localhost is not the Mac API; document emulator/phone networking separately. |
| EAS profiles | Retain `development` dev client. Add explicit Android APK build type to `preview` (beta/Clerk/HTTPS); use a proposed `android-store` profile extending preview with store distribution/AAB/autoIncrement for Play beta. Preserve `testflight`. Production uses production env/store AAB and remote versionCode. |
| Environment validation | If a new `android-store` profile is introduced, update `assertHostedBuildEnvironment` to validate it; currently it recognizes only preview/production/testflight. Retain separation of beta and production credentials/API URLs. |
| Credentials | Android keystore/upload key, Play app signing and FCM are separate from Apple credentials. Record ownership/backup/access before release. Do not create any during Phase A. |

Sources for manifest and distribution requirements: [Health Connect setup](https://developer.android.com/health-and-fitness/health-connect/get-started), [Android APK builds](https://docs.expo.dev/build-reference/apk/), [EAS credentials](https://docs.expo.dev/app-signing/managed-credentials/). Some existing plugins may introduce default permissions; inspect the final merged manifest rather than assuming this proposal is the generated result.

## Fastest safe implementation sequence

B1 and B2 source implementation are complete as recorded above; B2 native/physical qualification and B3–B7 remain outstanding. Each implementation phase runs repository-pinned Node 20, root lint/typecheck/tests and diff checks, plus its listed tests. Each UI phase applies the PRD visual/copy gate and the locked Step Planning contract. Separate deploy/build authorization remains required where not included in the future task.

| Phase | Exact objective and likely files/modules | Dependencies | Tests and completion criteria | EAS build? |
| --- | --- | --- | --- | --- |
| B1 — Android foundation and shared direct-provider path | Configure Android package/profile/Clerk callback diagnostics; thin native-health facade with unchanged iOS delegation and honest Android unavailable result. Root, lifecycle, onboarding native entry points, `app.json`, `app.config.ts`, `eas.json`, `lib/native-health/*`. Adapt existing brand assets. | This audit and an authorized implementation task; SDK 54 docs | iOS adapter characterization and config diff; Android manifest/bundle validation; auth and direct Fitbit + FatSecret setup/Today/History work; no native health claim. Inspect UI/back/keyboard. | Native development build needed for runtime proof; local build sufficient. EAS only when explicitly authorized. |
| B2 — Health Connect contract and device qualification | Evaluate/pin bridge; define normalized origin/time/evidence contract; read-only diagnostic spike for total, nutrition, steps, sessions and history. Proposed `lib/health-connect/*`, optional module, schema design and Android provider decision addendum. | B1; Android phone with writer history | Permission/availability/pagination/origin fixtures; real exact-package nutrition; establish at least one documented full-total burn origin and defensible workout pairing or explicitly withhold those capabilities. No unqualified banking uploads. | Native rebuild needed; local sufficient. No store build. |
| B3 — Additive ingestion and authority | New provider/schema support, source-specific evidence persistence, neutral lifecycle directive, session/outbox uploads and immediate existing finalization. Files listed in server/schema boundary section. | B2 contracts and qualification; reviewed additive migration | Equal-input accounting parity, zero/missing distinction, full-window preparation, provisional corrections, lock/opening immutability, source switching, cross-account/race/outbox tests. Old iOS requests/responses remain compatible. | No EAS for server/unit work; rebuild only if native contract changed. No deployment implicit. |
| B4 — Health Connect onboarding/connections and History | Complete role-scoped Android choices, discovery, empty/revoked recovery, historical options and foreground import in existing screens. Onboarding, integrations, History, provider presentation, native facade. | B3 plus qualified source evidence | All four source combinations in QA matrix; source switch during upload, persisted resume, permission recovery and exact-origin provisional History changes. No alternative setup truth. | Reuse development binary unless native permissions change. |
| B5 — Notifications/settings and full visual parity | Channel/permissions/FCM/settings routing; Android copy and all-screen visual fixes within canonical hierarchy. Notification helpers/module, settings, affected shared layout only. | B1; later credential authorization for real push; B4 for full health flow | Account-safe registration/detach/deletion and warm/cold tap; all copy; 320/360/412 logical widths, 130%+ text, TalkBack, gesture/three-button navigation, icons/splash. No missed channel state. | Native rebuild for FCM/module/manifest changes; physical preview APK needed. |
| B6 — Integrated physical release gate | Execute full QA matrix, record app/OS/writer versions, compare against canonical iOS build and inspect server evidence using test accounts only. Documentation/tests, scoped defects. | B1–B5 | No critical privacy/accounting/source-provenance failures; forecast stability explained by input evidence; all advertised providers qualified; unresolved limitations disclosed. | Signed preview APK required; EAS optional if locally signed equivalent is used. |
| B7 — Friends & Family and Play testing | Authorized signing/configuration/resources, internal APK cohort, then Play internal/closed AAB and eventual production track. EAS/release docs only unless QA fixes needed. | B6; Play identity/health policy/credential completion | Install/update/auth/push/HC work under final signing; internal and closed feedback complete; policy gates satisfied. iOS/TestFlight untouched. | Android APK/AAB builds required when authorized. No iOS build. |

B5's channel/settings implementation can follow B1 before Health Connect is complete, but B6 cannot be skipped. B2 is intentionally a narrow native evidence gate: it avoids spending time building a source picker around an unqualified burn assumption. If HC burn qualification fails, proceed with shared/direct and HC intake implementation, withhold HC burn advertising, and report that release combination blocked rather than inventing a fallback.

## Physical QA matrix

Minimum device coverage: one API 28–33 phone using installed Health Connect and one Android 14+ phone using system Health Connect; include an API 36 device for target behavior and a Samsung/OEM device as well as Pixel where available. Record OS, Health Connect system/app version, tracker version, package, wearable and firmware, CalorieBank build and environment. Emulator/toolbox fixtures can supplement logic and layout checks but cannot certify vendor exports, real OAuth returns, OEM settings or push delivery.

| Combination | Required evidence on real Android phone | Release gate |
| --- | --- | --- |
| Direct Fitbit + direct FatSecret | Hosted auth, both callbacks, post-midnight server queries, preparation, bank/history, steps/forecast when evidence exists, morning notification | First useful Android vertical slice; no HC dependency |
| Direct Fitbit + HC food tracker | Exact selected nutrition package, edit/delete/backfill, no second writer contamination; direct Fitbit unaffected | Test Cronometer and every other advertised nutrition writer separately |
| HC burn + direct FatSecret | Qualified full-total origin/local-day coverage, exact-origin activity, no active/total double count, independent intake | Block this combination until a real writer passes qualification |
| HC burn + HC food tracker | Independent origin selection by role, coherent burn/steps session, nutrition from selected origin only | Same qualification plus two-role permission/source races |

Execute the following against relevant combinations; “fixture + phone” means both are required for release:

| Scenario | Expected result | Verification |
| --- | --- | --- |
| Permission grant/partial grant/deny/revoke; HC disabled/update required; return from settings | Honest role status, no repeated unsolicited prompts, no fallback, direct-only setup still works | Phone |
| Connected empty vs query error vs explicit zero vs delayed export | Missing never coerced to zero or denied; recoverable preparation and Today | Fixture + phone |
| Multiple nutrition writers and direct/mediated duplicates | One exact origin/transport; changing HC global priority cannot silently change authority | Fixture + phone |
| Burn/activity source switch independent of intake; selected disconnect blocked as applicable | Explicit authority, retained inactive identity, no summation or workout merging | Fixture + phone |
| Foreground/manual refresh overlap, offline upload, process kill, retry | Coalesced runs, ordered account/source outbox, unchanged fingerprint skip, terminal session proof | Fixture + phone |
| Account A → B while browser/read/upload/token registration is pending | Stale work discarded; no A data or token association visible as B | Fixture + phone, dedicated test accounts |
| Cross-platform same account with Apple source selected | Android shows unavailable local source and offers explicit change; no automatic provider migration | iPhone + Android |
| Preparation seven days, holes, no positive suffix, interrupted import, initially empty then later available | Exactly one Opening Bank, correct suffix/no rows at zero; completion markers resume; no pre-opening repost | Fixture + phone |
| Midnight, DST, timezone travel, stale pre-midnight aggregate | Calendar windows and after-day-end proof preserved; no cached-current-day finalization | Fixture + phone clock/timezone scenarios |
| Provisional corrections, exact-date source override, locked/opening date attempts | Append-only deltas only where eligible; other dates/roles and immutable provenance unchanged | Server fixtures + phone UI |
| Step planning with one valid sample, missing evidence, 2–5 pace samples, paused/overlapping workouts | Existing thresholds; no daily-total division; appropriate unavailable states | Fixture + actual recorded walks |
| Stable cached reads, coherent new walk, non-step workout, delayed steps/burn, revised calibration | Same-input stability; every changed target explained by observed inputs; no smoothing or mixed generation | Fixture + phone/wearable |
| Morning positive/negative/zero, 07:00/11:59/noon, DST, failures, uninstall/token rotation | Existing eligibility/copy/idempotency; no notification-induced accounting; channel behavior verified | Server fixtures + physical FCM |
| Tap warm/cold/signed-out; app permission on but channel off | Today only after auth; recoverable settings; no old account data | Phone |
| Sign-out detach failure; deletion pending/retry/provider revocation | Existing recoverable flow and cleanup; no subsequent account exposure | Fixture + phone using disposable accounts |
| UI and accessibility | Card boundaries/hierarchy, dark 20px remaining lines, green totals/time, semibold sessions, select-all inputs, no clipping; correct reader order and touch targets | Phone + captured 320/360/412-width renders, larger text |

No physical tests, notification sends, screen-flow visual QA or Android builds were performed during this audit. Visual inspection covered static CB and Android foreground icon artwork, plus MacroFactor's official capability chart for research. This is not a UI release sign-off.

## Distribution strategy and Play requirements

Progression: local development binary → signed physical preview APK → invited Friends & Family APK cohort → Play internal AAB → closed testing → authorized public production release. APK sideloading helps early iteration; Play testing validates final app-signing, installation and update behavior. Avoid shipping a development client as the Friends & Family release.

Set up/verify a Google Play developer account, legal identity and contact details, app record/package, privacy-policy URL, Data safety disclosures, account-deletion disclosures/web route as required, health-app declaration, requested Health Connect permissions/use cases, screenshots/content rating and reviewer access instructions. Verify the actual account's obligations; none of these dashboards/resources was inspected or registered in Phase A. Health data must stay within declared user-facing purposes. [Health permission policy](https://support.google.com/googleplay/android-developer/answer/12991134?hl=en-GB).

As checked on 2026-09-11, new mobile submissions/updates must target Android 16/API 36. SDK 54 supports that baseline, but inspect generated manifest and native-library compatibility (including 16 KB page-size requirements) before upload. Recheck policy on submission day rather than relying on this snapshot. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [16 KB support](https://developer.android.com/guide/practices/page-sizes).

Use Play App Signing with a controlled upload key; document whether EAS manages that key, export a secure backup, and restrict credential access. APK preview signing and Play app signing can differ; include both relevant certificates in authentication configuration where required, and test the Play-installed artifact. Firebase client configuration is not the FCM service-account credential. Do not reuse Apple signing material.

For personal developer accounts created after November 13, 2023, current policy requires a closed test with at least 12 continuously opted-in testers for 14 days before applying for production access. Internal testing alone does not meet that requirement. Organization/older-account obligations must be checked in the actual console; production access is not automatic after a timer. [Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).

Play internal testing is the first store track; move to closed testing with a controlled tester list, evidence collection and a rollback/support plan. Public release waits for qualification, policy review and explicit release authorization. This task does not register a package, create Firebase/Clerk/Play resources, generate a keystore, submit or upload anything.

## Highest risks and decisions before dependent work

| Risk | Mitigation / owner gate |
| --- | --- |
| Health Connect type support mistaken for complete daily expenditure | B2 source-specific evidence; no banking capability until full-total or documented derivation qualification |
| Exact package provenance lost through existing Apple-only ingestion/schema | B3 additive provider/origin contract and backward-compatible migration review |
| Multiple origins share a mutable daily aggregate slot | Persist source-specific evidence and selection fingerprints; historical tests before source switching |
| Workout steps/active calories or active duration absent | Honest forecast availability; no fabricated calorie coefficient or pace; recorded-walk QA |
| BMR/history differs from HealthKit basal energy | Qualify resting evidence; extended history permission only when needed; no default 24-hour multiplication |
| Mixed Today measurement generations | Single cutoff/session/source, freshness and revision checks; preserve forecast stability gate |
| Native dependency/plugin incompatibility | Pinned bridge spike on SDK 54/New Architecture; narrow local module fallback, no SDK upgrade |
| OEM permissions/channel/Doze behavior | Pixel plus OEM physical matrix; no alternate scheduler |
| OAuth/account switch or outbox token ownership | Existing generation/attempt binding, source-scoped storage and interrupted-flow tests |
| Existing ambiguous push transport retry | Separate shared-service decision; do not promise exactly-once downstream delivery or silently change iOS semantics |
| Store policy/signing/package availability | Release resource check after authorization; API 36, health disclosures and Play-installed QA |
| Existing documentation/binary drift | Match canonical TestFlight build to commit before physical parity sign-off; do not treat older README scope as current behavior |

No open issue blocks B1. B2/B3 qualification and source persistence gate Health Connect banking; real phones, final credentials and Play review gate distribution. No date or effort estimate is reliable until the native qualification spike has run.

## Audit validation and exact next task

Documentation-only validation passed: `git diff --check`; a read-only Python check resolved all 21 relative Markdown links across the three changed documents; changed/untracked file inventory confirmed exactly three Markdown files and no product/config/native changes. The new untracked plan was also checked explicitly for trailing whitespace. No dedicated documentation/link script was found in root/workspace package scripts. Full implementation lint/typecheck/tests are not claimed for this audit; no implementation changed. External citations were researched, not exhaustively availability-tested by a link crawler.

Recommended next implementation prompt:

> CALORIEBANK — ANDROID PHASE B1: FOUNDATION AND SHARED DIRECT-PROVIDER PATH. Implement only B1 of docs/product/android-parity-plan.md using pinned Node 20 and Expo SDK 54. Preserve the canonical iOS product, all accounting and the locked Step Planning presentation. Add the minimum platform facade with unchanged Apple delegation and an honest unsupported Android native-health implementation; establish Android package/configuration and callback diagnostics, and retain the shared Fitbit + direct FatSecret path. Adapt only Android icon assets from the existing CB identity. Characterize iOS adapter behavior and run lint, typecheck, tests and documentation checks. Do not implement Health Connect ingestion, change accounting/server delivery semantics, register resources, deploy, modify production data, commit/push, or create any EAS build. Record remaining physical-build verification explicitly; stop at a reviewable foundation diff and propose the exact separately authorized native-build/qualification task.

**ANDROID PHASE A AUDIT: READY FOR IMPLEMENTATION** — foundation only; subsequent capability and release gates remain mandatory.


### Physical qualification and nutrition correction — 2026-09-12

Real Pixel 9a, Android 16 / API 36: production auth, direct Fitbit/FatSecret callbacks,
populated direct historical dates, account isolation and disposable-account deletion
were exercised. These are physical results; earlier emulator evidence stays separate.

Cronometer (`com.cronometer.android.gold`) received WRITE_NUTRITION only. CalorieBank
requested READ_NUTRITION only; denial, grant, revocation/re-entry and empty discovery
passed. A stable eight-date query found 17 records, today populated and seven earlier
dates empty. The old APK rejected legitimate same-time foods as ambiguous overlap.
The founder confirmed exported total agreement and separate food identity on-device.

Fix `0e59e0d49ef2978ac2048fcaf441af38140bb1c0` allows additive food-item intervals
following Android's [NutritionRecord contract](https://developer.android.com/reference/androidx/health/connect/client/records/NutritionRecord).
Exact-origin ID/revision deduplication, conflicting-revision rejection, missing-energy
and date-boundary checks remain. Steps/workouts/burn overlap checks, iOS and all
server accounting are unchanged. Different-ID duplicate exports remain a writer
quality limitation; timestamp overlap alone cannot diagnose them.

Release gate passed 790 tests in 67 suites. Exactly one replacement APK,
`6175d2d0-a0d5-4ee5-9230-e3f283fbaa60`, compiled successfully in EAS and installed on
the real phone. Corrected Cronometer selection now reports connected and Today
shows Imported from Cronometer. The founder confirmed the displayed intake matches Cronometer, and a full relaunch
retained the session and source. Extended historical/multiple-writer qualification
remains pending. Health Connect burn stays
**NOT QUALIFIED / disabled**. Notification permission works but registration failed;
FCM/token/delivery qualification remains B4. No Render or TestFlight operation.
See the [physical evidence and build record](../deployment/android-preview.md#pixel-9a-physical-qualification--2026-09-12)
for exact coverage, limitations, source-switch/account checks and remaining work.

### B4 FCM setup in progress — 2026-09-13

The missing Android Firebase client configuration was identified in the installed
APK. Firebase is now attached to the existing `caloriebank-505623` project, with
`com.caloriebank.mobile` registered and a dedicated FCM-only credential stored in
Expo. The temporary private-key download was removed. Android prebuild now
includes the non-secret Firebase client configuration; iOS remains unchanged.
This is infrastructure evidence, not physical push qualification. B4 notification
registration/delivery and the remaining physical release checks are still pending.
See [the preview record](../deployment/android-preview.md#b4-notification-infrastructure--2026-09-13-qualification-in-progress).
Health Connect burn remains disabled.

B4 follow-up physical evidence: the single Firebase-enabled APK compiled and
installed on Pixel 9a. Fresh Fitbit + Cronometer onboarding reached bank-ready;
notification registration, cold-relaunch On state, denial, and OS permission
recovery passed. Real delivery/tap, multi-account token transfer and token-aware
deletion remain pending; Android Friends & Family release is not yet qualified.

### B4 additional physical evidence — 2026-09-13

Return sign-in reached Today and Morning Bank Update On on the Pixel. Independent
token ownership inspection, real delivery/tap, and token-aware deletion remain
pending. Exact Cronometer nutrition diagnostics completed today plus seven dates
(September 6–13), with usable evidence on September 12 and truthful empty states
on the other dates. Server-total comparison and physical multiple writers remain
unqualified. Health Connect burn remains disabled. See the deployment and native
health documents for evidence boundaries; this does not establish the full B4
Friends & Family release gate.

### September 16 Cronometer upstream export recovery

On the Pixel 9a, iPhone-created Cronometer diary entries for September 13–16 were
visible in Cronometer but absent from Health Connect. Nutrition write permission
was granted and the integration active. Approved September 12–present Backfill
reported success but left native records unchanged. Opening/pull-refreshing each
affected date in Android Cronometer made them available: the unchanged APK's
exact `com.cronometer.android.gold` diagnostic increased from 17 to 34 to 85
Nutrition records, with September 12–16 ultimately usable under a stable read.
Today changed to Imported from Cronometer on normal foreground return, and the
founder confirmed the total matches. No reinstall, reconnect, source change, code
fix or build was needed. Historical server readback and remaining forensic checks
are separate from this native recovery evidence; overall B4 remains incomplete.
See android-health-connect.md for the controlled sequence and limitations.

### B4 immediate remote push qualification — September 16

The existing APK received one test through the deployed Expo push transport;
Expo accepted the ticket and returned an `ok` receipt. The founder physically
confirmed receipt and that tapping opened CalorieBank normally. Current Android
registration ownership was correlated with a Pixel foreground registration event.
No application/config change, build, deploy or scheduled delivery-record mutation
was needed. This qualifies transport and tap opening only; scheduled delivery,
post-tap identity, physical duplicate absence, account-transfer safety and remaining
B4 gates must not be inferred from it. See android-preview.md for detailed evidence.

### Android notification account ownership — physical PASS

On the same Pixel 9a, Account A (the authorized disposable account) owned the
active Android token before sign-out. A fresh authenticated foreground event
updated that same account/token registration, also confirming the account retained
after the first notification tap. The founder confirmed one prior notification
and no delayed duplicate. Normal Android Sign Out succeeded and a scoped server
read returned no Account A device registration before Account B signed in.

Account B (the separately authorized beta account) registered the same token under
a different internal authenticated account. A one-time guarded command using the
deployed ExpoPushTransport rechecked A had zero registrations, B had one active
Android registration, and the token had exactly one owner; it sent only one
“Account B notification test”. Ticket `01a0acd6-faf2-7009-a2ab-bb92f158e222` was
accepted and its subsequent Expo receipt was `ok`. The founder confirmed arrival
and tap opening Account B with none of Account A's data, in response to the
single-notification confirmation request. No duplicate was reported and no resend
was performed.

Post-tap independent server verification: A registrations 0; B active registrations
1; same Pixel token true; global token owners 1; Android registration active and
not invalidated. B's authenticated registration timestamp advanced to September
17 00:50:33.179 UTC after the tap. No message was sent back to A. Account/provider
data was preserved; only normal authentication/registration operations occurred.

Verdict: ANDROID NOTIFICATION OWNERSHIP: PASS. This does not qualify scheduled
morning eligibility or untested refresh/sign-out races. No code/config change,
APK, EAS build, Render deployment, TestFlight change or debug endpoint. Health
Connect burn remains disabled. Remaining overall B4 checks stay separate.

### Token-aware Android account deletion — September 17: PASS

Used the previously authorized disposable CalorieBank/Clerk identity (safe account
reference `4d61d0722c76`), not the non-disposable account used as B in the preceding
ownership test. The underlying Google/Gmail identity was untouched. Before
deletion: Clerk and internal identity existed, Morning Bank Update was On in UI
and server, one active Android registration, one global owner of the Pixel token,
Fitbit connected, Health Connect intake selected, no direct provider connection,
and zero scheduled delivery records. Raw credentials/tokens were never output.

Deletion ran exclusively through Settings → Delete Account → typed DELETE →
Delete Account. Scrolling and keyboard-open confirmation worked. The app returned
to Sign In and remained there after force-stop/relaunch, without stale Today or
History. Server read-only verification found Clerk 404, internal account count 0,
and zero rows for every Prisma model with this userId, including notification
registration/preference/delivery, provider credentials/connections/attempts, source
selection, aggregates, Opening Bank provenance and ledger. The Pixel token had
zero owners immediately after deletion. No manual database or Clerk deletion was
used. Successful completion passed the existing provider-revocation stage; an
independent provider-console revocation check was not performed. FatSecret was
not connected in this disposable account, so physical FatSecret cleanup was not
exercised. Scheduled delivery rows were already zero, so nonempty delivery cascade
was not physically exercised. Health Connect OS permission remains device-managed.

The authorized beta account (safe reference `221471ba80d3`, labeled C for reclaim)
then signed in normally. Morning Bank Update showed On. Server verification:
same Pixel token true, C active registrations 1, token owners 1, preference enabled,
deleted account 0, deleted registrations 0. Registration timestamp was
2026-09-17T17:21:35.420Z. No notification send was needed and no reclaim conflict
was observed. C's account and provider data were preserved.

Existing deletion sequence inspected: persist intent → disable push registration
→ provider revocation → Clerk deletion → idempotent internal cascade. Deterministic
`account-deletion-recovery.test.ts` and `pb2-account-safety.test.ts` were run under
Node 20: 12 tests passed across 2 files. Coverage includes transient revocation
retry, identity already absent, cascade retry, failed-revocation ordering and
already-absent internal identity. No production failure was artificially induced.
No code/config changes, build, deploy, TestFlight change or new notification.
Health Connect burn remains disabled. Verdict: ANDROID TOKEN-AWARE DELETION: PASS.
This closes deletion qualification, not the remaining overall B4 physical gates.

### September 17 product coherence and historical intake qualification

Android onboarding now keeps provider returns within the canonical Burn → Food →
Fitness Goal → Daily Bank Target → Preparation journey. Recognizable food choices
use exact observed Health Connect packages, with full-width Continue and separate
FatSecret direct connection. Canonical selection remains independent of connection
inventory. iOS behavior and Health Connect burn restrictions remain unchanged.

The September 16 discrepancy was an upstream Cronometer export gap: normal Android
diary refresh exposed 3,149 kcal instead of 2,716, and the existing ingestion path
persisted the complete amount. The History row is immutable Opening Bank provenance
and retains its original 2,716. No new retroactive accounting policy was introduced.
See [forensics](../engineering/android-health-connect.md#september-16-intake-discrepancy--september-17-physical-trace)
and [replacement qualification](../deployment/android-preview.md#september-17--android-product-coherence-qualification).
Automated release gate: 813 tests pass. Replacement native build and Pixel UI
requalification remain pending before final B4 race/accessibility work resumes.

### September 18 — product coherence physically requalified

The single replacement APK completed native cloud compilation and was installed
on Pixel 9a, Android 16/API 36. A genuinely fresh disposable account physically
completed Fitbit → Cronometer → Fitness Goal → Daily Bank Target → Preparation →
Today with coherent Back navigation and no Health Connections callback detour.
Post-setup canonical cards, server exact-package selection, historical preparation,
notification setting/registration, Today/History/Banking Goal and locked Step Planning
smoke checks passed. Existing September 16 immutable Opening Bank evidence remained
unchanged. Current-day Cronometer intake was absent during this pass; no populated
current-day claim is made. No implementation changes or additional APK were needed.

**ANDROID B4 PRODUCT COHERENCE: PASS — READY FOR FINAL RACE/ACCESSIBILITY QA**

See [physical evidence](../deployment/android-preview.md#september-18--physical-product-coherence-pass).
Final race/accessibility work requires separate founder authorization. This is not
Google Play or overall B4 distribution sign-off. Health Connect burn stays disabled.


### September 18 final B4 physical qualification

Existing APK `7de86e07-019b-45b3-8e21-33edd6e94e23` passed the Pixel 9a
Android 16/API 36 accessibility smoke test (200% text and founder-confirmed TalkBack)
and same-device Cronometer test. A +50 kcal entry created directly in Android
Cronometer appeared through normal CalorieBank foreground refresh without another
Cronometer open/sync action (Case A). Exact-package server evidence matched both
controlled additions (+95 total). Cross-device iPhone-to-Android Cronometer export
latency remains a separate documented upstream limitation. Health Connect burn is
still disabled. No implementation/build/deployment changes were required.

See [physical evidence and limits](../deployment/android-preview.md#september-18--final-accessibility-and-same-device-cronometer-pass).
Android B4 is ready for Friends & Family distribution; Google Play work still
requires explicit authorization. No broader OEM or formal WCAG coverage is claimed.


### Phase C distribution preflight

Google Play testing is not live. See [current requirements and release gates](../deployment/android-google-play.md). Account enrollment/identity, public privacy/deletion resources and the nutrition-only permission-minimization gate must be resolved before the single testing AAB. B4 product qualification remains unchanged.


### Phase C preparation — nutrition-only Play profile

Authorized preparation now supplies a `play-testing` AAB profile with only Health
Connect READ_NUTRITION, explicit diagnostic gating at navigation and native bridge,
and retained opt-in internal qualification. No AAB was created. Draft legal pages,
organization checklist and declaration worksheets are linked from
[Google Play preparation](../deployment/android-google-play.md#september-18--authorized-release-preparation-completed).
Full release gate and all workspace tests: 827 passing tests. This is automated/config
qualification, not a new physical Play-install claim. Health Connect burn remains
disabled; organization/legal input and approved public hosting remain required.


### Phase C active organization and Play setup — September 19

Organization enrollment and public legal resources are complete. The canonical
CalorieBank Play app exists with saved declarations, including founder-approved
18-and-over targeting for current V1 only. Internal Testing is not live yet.
An authorized Android-only Settings Privacy Policy link closes the in-app policy
requirement; 830 tests pass and Nutrition-only store configuration/prebuild checks
pass. Store assets, signing, the single AAB and Pixel Play installation remain.
See [current distribution evidence](../deployment/android-google-play.md).
B4 functionality and Health Connect burn-disabled status are preserved.

### Phase C Internal Testing available — September 20

The single store AAB (EAS `4dc1d697-266a-42a7-afd7-a3192daa20cf`, source `88bd631`,
1.0.0 / versionCode 2) compiled and was accepted by Google. Actual bundle manifest
has only READ_NUTRITION for Health Connect, package `com.caloriebank.mobile`, target
SDK 36. Internal Testing is active for the one approved founder tester; listing is
not yet reviewed and uses Google's temporary name. Pixel Play installation and smoke
checks passed after the founder-approved migration from the differently signed preview.
No Production/Open release, additional build, Render deployment or TestFlight change.
Health Connect burn remains disabled. See [distribution evidence](../deployment/android-google-play.md).


### Phase C Pixel Play installation qualified — September 20

Google Play-installed 1.0.0 (2) restored the reviewer account and an authorized existing
beta account through production Clerk. Reviewer Fitbit/FatSecret remained connected;
beta Fitbit recovered through approved same-account reconnect and Cronometer through
Nutrition-only permission. Founder confirmed current Eaten matches; Today, History,
populated locked Step Planning and cold session restoration passed. Morning Bank
Update read On for both accounts in sequence; OS permission is granted. Registration
readback and normal sign-out cleanup were exercised, without a new independent token
owner-count query or push send. Prior B4 transport/ownership evidence is separate.
No product change, extra build, public release, Render deployment or TestFlight change.
Health Connect burn remains disabled. Private Internal Testing is available to the
one approved founder tester. Additional tester invitations and listing/closed-track
review are not claimed complete. See the detailed distribution evidence above.
