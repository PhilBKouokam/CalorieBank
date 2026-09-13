# Android Health Connect evidence and nutrition integration

## B3 qualification checkpoint

B3 installed the local Android toolchain, generated the native project and found
an actual minimum-SDK manifest conflict. The Health Connect config plugin now sets
API 26, as required by `connect-client:1.1.0`; runtime Health Connect availability
still requires API 28. Native manifest merging, Health Connect Kotlin/Java and its
Expo permission-delegate module compile with Expo 54. See the
[B3 local qualification record](../deployment/android-preview.md) for the full
build result, environment limits and remaining installation gates.

A separate nutrition-only qualification service now uses the existing bounded
read/generation/permission/change-token logic. It requests only `READ_NUTRITION`
and reads only Nutrition even when activity permissions were previously granted.
The beta diagnostic screen has an explicit nutrition-only switch. The diagnostic screen remains read-only and never uploads. The separate consumer
`nativeIntake` facade explicitly selects one account-owned package and uploads only
normalized nutrition evidence after a stable read. Supported Android combinations
are Fitbit + direct FatSecret and Fitbit + qualified Health Connect nutrition.

Exact package display mappings were verified from publisher Google Play listings:

| Package identity | Display label / source |
| --- | --- |
| `com.cronometer.android.gold` | [Cronometer](https://play.google.com/store/apps/details?id=com.cronometer.android.gold) |
| `com.myfitnesspal.android` | [MyFitnessPal](https://play.google.com/store/apps/details?id=com.myfitnesspal.android) |
| `com.fitnow.loseit` | [Lose It!](https://play.google.com/store/apps/details?id=com.fitnow.loseit) |
| `com.sbs.diet` | [MacroFactor](https://play.google.com/store/apps/details?id=com.sbs.diet) |
| `com.fatsecret.android` | [FatSecret](https://play.google.com/store/apps/details?id=com.fatsecret.android) |

These identify packages, **not verified Health Connect export support**. Unknown
packages display “Food tracker” while retaining their exact identity. The discovery
helper accepts only stable nutrition-only reports; healthy direct FatSecret takes
priority over exactly `com.fatsecret.android`. Failed direct connections do not
suppress that writer. No fuzzy/prefix/display-name authority matching is used.

No physical writer, permission, revision, empty-diary or preparation evidence is
claimed. Nutrition remains conditional; burn remains **NOT QUALIFIED / DISABLED**.
The consumer flow, exact-source persistence and preparation integration are now implemented;
physical writer qualification remains outstanding. See the build record for actual
emulator checks and the distinction between native compilation and physical QA.

### B3 source and persistence boundary

- `native-health/intake.android.ts` uses the B2 nutrition-only qualifier. The iOS
  facade adds only an unavailable intake-service export; its HealthKit aliases stay unchanged.
- `native-food.android.tsx` is the explicit discovery/selection/recovery screen.
  Onboarding and Connections offer it only for Calories Eaten. Burn never exposes Health Connect.
- `health_connect` is an intake-only provider. Banking/expenditure provider schemas
  reject it. Steps, workout calibration and full-day burn remain diagnostic-only.
- `nativeIntakeSource` stores `{namespace: android_package, id: exactPackage}`.
  Source labels never determine authority. Healthy direct FatSecret suppresses its
  exact Android writer in discovery/alternatives; an already-selected writer remains
  visible until the user explicitly changes authority.
- `POST /v1/me/ingestion/native-intake` accepts one exact source, selection revision,
  observation/query timestamps and exactly today plus seven completed local dates.
  It rejects stale selection, wrong origin, mismatched date windows and older snapshots.
  Account ownership comes only from the authenticated request.
- A transaction persists normalized daily totals and full-window query proof under
  the existing Opening Bank advisory lock, then invokes the existing finalization
  scheduler. No local Opening Bank calculation or second accounting engine exists.
- The additive migration stores source identity on intake aggregates, sync sessions,
  historical overrides and snapshots. Legacy intake rows retain empty `sourceId`;
  existing fingerprints omit the new field unless the source is Health Connect.
- Empty and missing-energy evidence never become zero. Explicit numeric zero is
  usable. Ambiguous overlaps/day boundaries remain unavailable and preparation
  retryable. A later refresh can recover; initialized Opening Banks stay immutable.
- Foreground refresh reads the selected account authority first. Sign-out/account
  scope changes invalidate local discovery and reads; OS permissions are not selections.
- Records/revision tokens remain device-local. Uploads contain normalized totals,
  package identity and timing/provenance only; diagnostics never log raw records.

### B4 requirements and compatibility

Qualify populated nutrition, multiple writers, deletion/revision, foreground races,
source/account switching and both preparation combinations on a physical phone.
Verify Android 9–13 standalone Health Connect separately from system-integrated
Android 14+. Complete notification token/delivery qualification and Step Planning
keyboard/font-scale visual QA without changing formulas or locked presentation.

A B3 Android account selecting `health_connect` introduces a provider enum unknown
to older B1/B2 iOS binaries. Existing iOS accounts using their existing sources retain
the same response shape and behavior, but cross-device use of an Android-selected
account on that old binary is **not qualified**. Do not distribute this as general
iOS/Android account parity or silently map Android evidence to Apple Health. An
explicit backward-compatibility/client-upgrade strategy is required before broader
rollout; no iOS build or TestFlight change was made here.

## B2 implementation record

The sections below preserve the historical B2 record. B3 additions above and the
[preview delivery record](../deployment/android-preview.md) supersede B2-only
statements about unavailable consumer flows, native compilation and build counts.

Implemented against B1 `aa50cdd7b6c2c486e5a5e0eae1f2a097fbaa8a36` on 2026-09-11.

**ANDROID PHASE B2: PASS — HEALTH CONNECT BURN REMAINS UNQUALIFIED**

This verdict covers the read-only source implementation, automated qualification rules and native project generation. It does not certify a working Android binary, a particular writer, permission interaction on a phone, or production-authoritative Health Connect ingestion. No Android phone/emulator, JDK, SDK or ADB was available. No EAS build was created.

See the [canonical parity plan](../product/android-parity-plan.md) and [B1 foundation](android-foundation.md). iOS remains canonical. Direct Fitbit/FatSecret, bank calculations, server source selection, immutable records, ledger, Opening Bank and forecast/Step Planning semantics remain unchanged.

## Chosen integration and verified limits

Pinned `react-native-health-connect` **4.1.3**, published/currently maintained in August 2026. Its Android implementation uses `androidx.health.connect:connect-client:1.1.0`, supports the new React Native architecture, and includes an Expo activity lifecycle package that registers the permission delegate. Its peer range accepts this project's Expo 54/React Native 0.81.5; no SDK upgrade was performed. Verified source APIs: SDK status, initialization, read permissions, granted permissions, paginated record reads, metadata, changes tokens and system settings. See [upstream source](https://github.com/matinzd/react-native-health-connect), [releases](https://github.com/matinzd/react-native-health-connect/releases) and [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).

Both Expo and React Native Android autolinking resolve; generated `ExpoModulesPackageList.java` includes `expo.modules.healthconnect.HealthConnectPackage`. iOS autolinking excludes this dependency. The Android JS export contains Health Connect; the iOS export retains HealthKit and excludes Health Connect. These are structural compatibility checks, **not native compile proof**. The upstream example currently targets a newer SDK; this app still needs an SDK 54 native compile and permission-handler runtime check before installation is approved.

One upstream correctness defect required a small pinned patch: `ReactNutritionRecord.kt` calls a nullable-energy converter that maps null to zero. `apps/mobile/scripts/patch-health-connect.cjs` changes only that record's energy serialization to preserve null. It is version-checked, idempotent, runs after the existing root postinstall, and fails if the known target changes. A regression inspects the installed Kotlin line and exercises null versus explicit zero through the adapter. No other upstream code or iOS native code is patched. Upgrading requires reevaluating this patch; no upstream support claim or submission was made.

The app's `with-health-connect.cjs` replaces the upstream manifest-only plugin with a small equivalent that sends both Android permission-rationale entry points to an actual, generated `HealthConnectRationaleActivity`, rather than opening Today. It uses the library's unchanged Expo permission delegate. Isolated `expo prebuild --platform android --no-install` generated and verified the Java activity and manifest. The activity displays purpose, categories, read-only/in-memory handling and revocation instructions; it receives no health records. Play policy/privacy publication remains a later release gate.

## Facade and typed availability

`NativeHealthBridge` now optionally describes a `NativeHealthQualification` surface. The Android facade exports the real qualification service while keeping normal connection/sync paths unavailable and reporting `supported: false, reason: not_qualified`. That flag means **eligible as a product source**, not SDK presence. Existing iOS exports and implementations are unchanged.

Availability distinguishes `available`, `setup_required` (install/update/provider action), `permissions_missing`, `partial_permissions`, `unavailable`, `unsupported_version` (below API 28), and `native_query_failed`. A completed read independently reports `complete`, `no_records`, `access_required`, `query_failed`, `changed_during_read` or `cancelled`. “Complete” means the bounded query completed, not that a provider supplied a complete day or banking input.

No query runs from Today, onboarding or normal foreground lifecycle. An authenticated tester explicitly opens the beta/development diagnostic tool. Requests are read-only. Account-scope changes and screen/background cancellation invalidate outstanding generations. Failed/expired/paginated-incomplete reads publish no partial day values. Native exception text and raw payloads are not logged.

Health Connect is integrated with Android 14+ and installed separately on applicable Android 9–13 phones. Device support must be checked at runtime. A setup-required result can open the Health Connect Play listing; otherwise the tool opens Health Connect settings. The implementation never calls native permission revocation, whose process-lifetime behavior is unsuitable for an immediate disconnect guarantee.

## Permissions and history scope

Exactly these seven `android.permission.health.READ_*` permissions are declared/requested:

| Suffix | Native record | Purpose |
| --- | --- | --- |
| `NUTRITION` | Nutrition | Exact-writer consumed-energy evidence; distinguish null from explicit zero |
| `STEPS` | Steps | Selected-origin daily step evidence and overlap inspection |
| `EXERCISE` | ExerciseSession | Session type, duration, origin and revision evidence |
| `DISTANCE` | Distance | Inspect whether independent distance evidence exists; no fabricated session association |
| `ACTIVE_CALORIES_BURNED` | ActiveCaloriesBurned | Inspect burn evidence; never add to a provider total |
| `TOTAL_CALORIES_BURNED` | TotalCaloriesBurned | Inspect full-total candidates and interval coverage |
| `BASAL_METABOLIC_RATE` | BasalMetabolicRate | Inspect rate availability and establish its distinction from completed resting expenditure |

No writes, routes/location, medical categories, sensor permission or background reads. No extended-history permission is requested: this phase queries **today plus seven completed local dates**, entirely inside the default 30-day pre-grant lookback. The window is built using the existing calendar-day helper (including DST), not fixed 24-hour subtraction. Today ends at a frozen query-start instant. Empty dates remain empty; uncompleted/failed queries cannot count as preparation proof. [Android read/history documentation](https://developer.android.com/health-and-fitness/health-connect/read-data).

This implementation deliberately has no arbitrary old-history API. B3 must separately handle extended forecast history, long absences, reinstall/regrant restrictions and feature availability before querying beyond the permitted range. Successful eight-day reads do not prove any older history exists. No Opening Bank is calculated or initialized locally, and no preparation completion is posted to the API.

## Exact source identity and nutrition

Each decoded record requires Health Connect metadata ID, `dataOrigin` package string and `lastModifiedTime`. Client revision, timestamps and provided UTC offsets are retained at the private adapter boundary. Selection uses `{ namespace: 'android_package', id: exactPackage }`, never a display-label match. Distinct packages cannot satisfy each other's intake selection. IDs are deduplicated within category **and origin**; newer revisions replace earlier ones, conflicting identical revisions invalidate the read.

Discovery lists origins actually observed in the bounded, permitted records. This is not an installed-app inventory or proof an app is connected. The report distinguishes observed, never observed and previously observed but now absent. Absence may mean deletion, no records in the moving window, changed exports or revoked access; it never proves uninstallation. For an observed package, per-day nutrition distinguishes missing permission, no records, records without energy, usable energy, ambiguous overlap and day-boundary ambiguity. A different populated tracker never fills the selected writer's empty day.

**Nutrition verdict: conditionally usable evidence, not production-authoritative.** For one exact package, sum only decoded, non-overlapping calorie records wholly contained in the selected local day. Do not sum all writers. A true zero-energy record is distinct from null energy or no records. Different IDs with overlapping/equal intervals are withheld as ambiguous rather than heuristically deduplicated; B3 writer-specific tests must determine whether these are duplicate exports or legitimate same-time entries. Cross-midnight records are not prorated. Nutrition has no universal complete-diary indicator. [Android aggregation semantics](https://developer.android.com/health-and-fitness/health-connect/aggregate-data).

The library supports native `dataOriginFilter`; B2 discovery reads all permitted origins, then filters strictly before computing any selected-origin value. B3 may optimize known-source reads with that native filter but must retain the exact-match check. No Android package is written into the existing Apple-specific `writerBundleIdentifier` server field. Persisted provider-neutral exact-origin authority remains B3 work.

No package-to-brand allowlist is invented. Cronometer, MyFitnessPal, Lose It!, MacroFactor, Fitbit and other writers can be distinguished **when their distinct packages actually appear**. Neither a brand name nor the API's record type proves that the installed app writes nutrition/activity. Qualify each app/version on the phone before advertising support. Direct Fitbit and FatSecret retain their existing independent integrations; Health Connect does not replace or augment them in B2.

## Steps, sessions and walking

**Steps verdict: conditionally usable exact-origin evidence.** Normalize only one selected activity package. Deduplicate IDs; withhold overlapping intervals or cross-day ambiguity rather than summing multiple devices/writers. Health Connect's general Activity aggregate can apply the user's app-priority list, which is not CalorieBank's persisted source-authority contract. No all-source aggregate is used. A missing day is null, not zero. Edits/deletions are observed through fresh queries and change checks.

**Exercise verdict: session identity/type/timing usable as evidence; calibration unqualified.** Walking/running exercise types map into the existing normalized activity vocabulary; ID, timestamps, duration and provider update time are retained. Notes, titles, routes and other personal details are dropped. Overlapping sessions are withheld as ambiguous; repeated IDs are deduplicated.

ExerciseSession does not itself supply the required paired active calories and steps. Independent interval records do not establish a reliable foreign-key association to a workout. Therefore normalized `totalEnergyBurned`, `totalSteps` and `totalDistance` remain null; distance/energy/step record counts are diagnostic evidence only. No overlapping-interval guess, BMR subtraction, expenditure-per-step division, invented zero or new calibration formula is used. The existing planner receives no Android calibration or walking-time estimate from this phase.

## Full-day burn critical gate

**Verdict: NOT QUALIFIED for CalorieBank. No writer/device combination has physical qualification evidence.**

`TotalCaloriesBurnedRecord` has the right conceptual scope: active plus basal energy over an interval. That does not establish that the chosen writer exports complete, fresh, non-overlapping coverage for each local day. The adapter inspects exact-origin total/active/rate records and reports total interval coverage (`none`, `gaps`, `ambiguous`, `complete_intervals`). Even complete temporal coverage leaves burn **not qualified**. [Official total-calorie semantics](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/TotalCaloriesBurnedRecord).

Active calories exclude basal expenditure. BMR is a rate, not measured completed-day resting energy; an aggregate API can derive values with semantics different from a provider's completed total. No `active + BMR`, `total + workout`, or cross-writer fallback is implemented. The 0.8 adjustment is never calculated in this bridge. `caloriesBurned` is always null and `authoritative` is always false.

A later writer qualification needs multi-day device evidence: complete local-day windows including DST/travel, writer-reported total comparisons, revision/deletion/backfill behavior, passive and exercise periods, no duplicated components and correct completed-day timing. Approval must identify the writer/device/version and its evidence contract. Neither a number nor an aggregate API response can unlock burn automatically.

## Temporal consistency and normalized models

One read captures a frozen cutoff, the eight local windows, exact origin, query-start/observation timestamps, monotonically changing account/query generation, per-value provider update times and report-level latest update time. A Health Connect change token is captured before pagination and checked after all categories; any intervening upsert/delete, expiry or unread change page discards the result. Granted permissions are checked before and after. Account switch, cancellation, backward clock or timezone changes also invalidate the run. Queries use bounded pagination, per-call timeouts and a total read budget; no automatic retry loop or outbox exists.

`stable_read` means no SDK mutations were detected during this bounded read. It is **not** proof that a writer synchronized steps and burn together, nor an atomic OS transaction. Stale-but-stable records can still have different provider update times. Consequently `forecastEligible` remains false, and the bridge never combines current clock progress with stale health data or feeds Today/Step Planning. B3 must preserve this distinction when defining a qualified snapshot contract.

Native records stay in `lib/health-connect`. Shared `native-health/evidence.ts` reuses `Pick` types from existing normalized intake, steps and workout models, adding only mobile evidence status/source/window metadata. There is no `IOSHealthData`/`AndroidHealthData` domain fork, new schema/provider enum, database migration or API endpoint. Amounts are in-memory qualification evidence; diagnostics render only counts, exact packages, date windows and quality/coverage states. No raw record, calorie amount, auth token, account ID or notes are logged/exported by the tool.

## UI and physical script

Beta/development Android Settings adds “Health Connect qualification”. The existing diagnostics route resolves to the Android test screen with an Android-specific header. Production redirects to Connections without querying Health Connect. Normal onboarding/source choices remain B1 direct-provider-only. The iOS screen/header remain unchanged.

Run the following on **both** an Android 14+ system-Health-Connect phone and an Android 9–13 phone with supported standalone Health Connect. Record device/OS, HC version, app commit/binary, writer package/version and test-only account. Do not paste real records or personal calorie values into logs/issues.

1. First compile and start the Android app under Expo 54; confirm permission delegate registration and no startup failure. This is a prerequisite, not already performed.
2. Open the test tool before granting access: verify missing permissions; deny all, then allow nutrition only and verify partial state. No writes/unrelated categories should appear.
3. Open the permission-rationale link on both OS families: verify the dedicated access explanation, then return safely. Exercise install/update-required and unsupported device paths where available.
4. With no health records, inspect: expect empty results and null values. Add a supported writer, discover its actual package, choose it and inspect again. Compare counts/date windows against the Health Connect data viewer.
5. Use two distinct nutrition writers. Populate only A, select B: B remains empty. Add B, switch back to A: no cross-writer sum. Test legitimate zero-energy entries, nutrition without energy, same-time different IDs, revisions and deletions. Verify the native null patch on real records.
6. Populate steps from one source, then a second or overlapping source. Verify exact-package isolation and overlap withholding. Refresh after revisions/deletions; no stale retained total.
7. Record walking/running workouts. Verify type/duration/origin/counts; missing paired metrics must keep walking calibration disabled even when independent steps/energy exist.
8. Populate total-energy intervals with gaps, overlaps and full-day coverage. Verify coverage diagnostics but **NOT QUALIFIED** in every case. Compare export semantics with the originating provider outside the app before proposing a writer qualification.
9. Verify today plus seven completed dates, empty middle dates, cross-midnight records, DST and travel. Do not count query errors as empty history. No Opening Bank/ledger changes should occur.
10. Revoke permissions in Health Connect, return and read again. Verify updated missing/partial state; revoke during a query and confirm results are discarded. Repeat after process restart.
11. Edit/delete records during pagination, background the app, or switch CalorieBank accounts during a read. Expect cancellation/changed evidence, no mixed snapshot, and no cached report crossing accounts.
12. Recheck direct Fitbit/FatSecret, iOS regressions and founder-locked Step Planning. Inspect narrow screens, large fonts, safe areas, native back, TalkBack and permission return paths.

**Actually performed:** source/API inspection, fixture tests, generated-project/manifest checks, iOS/Android JS exports and a synthetic narrow-width diagnostic rendering. No native compile, emulator, Android app startup, permission dialog, real writer read, physical OAuth or physical iOS regression test was performed.

## Validation and build decision

Pinned Node 20; full release gate, workspace/API/mobile TypeScript, mobile lint, API tests/build, Expo config/dependency checks, Android/iOS autolinking, isolated Android prebuild and diff/link checks. The release gate includes Prisma generation/validation against the dedicated localhost test database; no schema changed and no production data was accessed. The full gate passed **732 tests across 62 files**, including 33 new tests for qualification, the native contract/null patch and diagnostic UI. One existing Today lint warning remains.

The online Expo dependency validator reports dependencies up to date. Native project generation passes. Native compilation/startup cannot be attempted without JDK/SDK/ADB. Therefore the user's conditions for exactly one remote preview are **not met**: **zero EAS Android builds**, no AAB, no Play submission and no iOS/TestFlight build. Configure a local Android toolchain and prove compile/startup first; only then consider the explicitly authorized single preview APK for real-device qualification.

## B2 handoff to B3 (historical)

Start B3 with native compile/startup and the physical script above. Keep burn disabled until writer-specific proof exists. Then implement the Android Connections/onboarding path for qualified exact-origin nutrition: persisted provider-neutral identity and source selection, origin-aware per-day storage/revisions, normalized ingestion API validation, account isolation, deliberate bounded preparation and truthful permission/empty/revoked states. These require separately reviewed additive server contracts; never upload Android evidence as `apple_health`. Keep direct Fitbit burn + Health Connect nutrition as the first candidate combination.

Resolve nutrition overlap semantics per verified writer before exposing it. Keep forecast/step-calibration use disabled unless existing paired-evidence and coherent-snapshot contracts are satisfied. Preserve server-only accounting and immutable source history. FCM, distribution credentials, Play declarations and public release remain later gates. Continue using `[skip render]` for mobile-only commits; B2 requires no Render deployment.

## Changed files

- `apps/api/tests/android-foundation.test.ts`
- `apps/api/tests/health-connect-diagnostics.test.ts`
- `apps/api/tests/health-connect-native-contract.test.ts`
- `apps/api/tests/health-connect-qualification.test.ts`
- `apps/mobile/app.json`
- `apps/mobile/app/(settings)/_layout.tsx`
- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/lib/health-connect/bridge.android.ts`
- `apps/mobile/lib/health-connect/normalize.ts`
- `apps/mobile/lib/health-connect/qualification.ts`
- `apps/mobile/lib/native-health/copy.android.ts`
- `apps/mobile/lib/native-health/copy.ts`
- `apps/mobile/lib/native-health/evidence.ts`
- `apps/mobile/lib/native-health/index.android.ts`
- `apps/mobile/lib/native-health/types.ts`
- `apps/mobile/package.json`
- `apps/mobile/plugins/with-health-connect.cjs`
- `apps/mobile/screens/health-diagnostics.android.tsx`
- `apps/mobile/scripts/patch-health-connect.cjs`
- `docs/engineering/android-foundation.md`
- `docs/engineering/android-health-connect.md`
- `docs/product/android-parity-plan.md`
- `package-lock.json`
- `package.json`


## B3 delivery qualification status

Native compilation and signed EAS APK startup passed. Nutrition permission grant,
empty discovery and revocation recovery were exercised on an emulator only. Populated
origins, physical nutrition records and complete account flows remain pending.
The signed preview's hosted sign-in fails; production Clerk has no Android registration
and only the iOS redirect allowlisted. No production Clerk setting was changed.
See the [delivery record and concrete auth prerequisite](../deployment/android-preview.md#blocking-hosted-auth-configuration-finding).
Health Connect burn remains disabled. B3 is blocked on authentication rather than
certified for Friends & Family distribution.


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
