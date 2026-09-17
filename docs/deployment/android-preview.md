# Android B3 local qualification

Work started from `df792a9017eaf3a5d30f27f7ee0103926e5818cd` on 2026-09-11.
B3 implements the nutrition consumer path and has passed native compilation and
emulator startup. The production Clerk Android registration was added on 2026-09-12;
the replacement callback fix now passes two existing-account email-code returns on
the emulator. See the latest callback qualification below. Physical QA remains pending.
Health Connect burn remains disabled.
The single signed preview is complete; see the delivery record below.

## Local toolchain

The task installed tooling in `/tmp/caloriebank-android-toolchain` on the Apple
Silicon Mac. Nothing was added to global shell startup files. These temporary
paths may be removed by the OS; retain the versions and commands, not a dependency
on this particular path.

| Component | Version |
| --- | --- |
| Node | repository-pinned 20.20.2 |
| JDK | Eclipse Temurin 17.0.20.1+1, macOS ARM64 |
| Android command-line tools | 22.0 / archive 15859902 |
| Platform tools / adb | 37.0.1 |
| Compile / target SDK | 36 |
| Minimum application SDK | 26; Health Connect runtime support still starts at 28 |
| Build tools | 36.0.0; Gradle also installed 35.0.0 for a dependency |
| NDK | 27.1.12297006 (r27b) |
| CMake | 3.22.1 |
| Gradle wrapper | 8.14.3 |
| Kotlin | 2.1.20 |

The SDK/NDK choices follow the generated Expo 54 / React Native 0.81.5 project.
[React Native environment guidance](https://reactnative.dev/docs/set-up-your-environment)
recommends JDK 17. Tooling came from Adoptium and the
[official Android command-line distribution](https://developer.android.com/studio).
SDK licenses were accepted as part of the requested toolchain installation.

The first native compile found a real manifest conflict: Expo's default minimum
24 was lower than `connect-client:1.1.0`'s minimum 26. The existing Health Connect
config plugin now writes `android.minSdkVersion=26` during prebuild. The next
native build passed manifest merging. No `overrideLibrary` bypass is used, and
iOS configuration is unchanged. This does not claim Health Connect availability
on API 26–27; the runtime bridge still returns `unsupported_version` there.

Reproduce from the mobile directory using a compatible local toolchain:

```sh
export JAVA_HOME=/path/to/jdk-17/Contents/Home
export ANDROID_HOME=/path/to/android-sdk
export GRADLE_USER_HOME=/path/to/task-gradle-cache
export NODE_ENV=development
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain
```

Use the repository-pinned Node 20 on `PATH`. The ARM64 restriction applies only
to this local compile, not to EAS release configuration. Native generated files
remain ignored; regenerate through Expo. Do not commit machine-specific paths,
SDK files, credentials or generated native build output.

## Native compilation and emulator evidence

The ARM64 `assembleDebug` build succeeded (543 tasks) after fixing the real minimum
SDK conflict. Health Connect, its Expo permission delegate, Clerk and the React Native
new architecture compiled. The debug APK installed and launched on API 34 ARM64 AOSP
(revision 4), using a disposable `CalorieBank_B3_API34` AVD. No physical phone was connected.

The final local native rebuild also **passed** in 7m 51s: 543 tasks (28 executed,
515 up-to-date), including the updated permission-rationale text. An intermediate
attempt exhausted disk space, and another encountered stale transforms after cleanup.
Stopping the daemon, recovering only task-created emulator/cache files and rebuilding
the cache resolved both. No compiler incompatibility was bypassed. The debug APK was generated under
`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Generated local native
outputs and task Gradle caches were subsequently removed to recover disk space; the
signed EAS APK is retained separately below.
The final APK was compiled after the emulator tests; the nutrition JavaScript flow
was exercised through Metro on the earlier successful native binary. No physical
startup is claimed. The signed remote preview was subsequently installed on both emulators.

Actually exercised in the emulator:

- CalorieBank branding, Expo Router, Clerk test-key initialization and Sign in/Create
  account entry. No real beta login or direct-provider OAuth completion was attempted.
- Local development API connectivity using the dedicated localhost test database,
  a temporary public environment override, and `adb reverse`. Saved `.env` credentials
  were unchanged. The temporary override was removed after testing and before packaging.
- System-integrated Health Connect setup and the real OS consent screen. Nutrition-only
  consent displayed only Nutrition under read access and the 30-day history explanation.
- Consumer permission grant and truthful empty discovery: “No food trackers were found”.
  No installed food writer, populated nutrition, exact-origin record or revision was
  physically qualified. Automated origin/revision tests are not device evidence.
- Nutrition revocation via Android permission management terminated the app; after
  restart it returned to “Allow food access”, without changing server authority.
- Visual inspection of the food screen at 320 dp and 393 dp with 130% font scale:
  readable wrapping, spacing, buttons and navigation; no clipping observed. No
  populated tracker rows or Step Planning cards were visually certified.
- Emulator version 37.1.11.0 (build 15917651). The disposable emulator/image/AVD
  was removed temporarily to recover compilation space, then restored after
  stopping the build daemon and clearing task transforms for signed-APK testing.
  All tooling remains isolated; no global shell files were edited.

A development-only hot reload from Clerk to local auth briefly left an old Sign In
route mounted without its Clerk provider. A fresh local app navigation resolved it;
this was not a hosted Clerk startup failure. No production auth behavior was changed.

## Supported source paths and server delivery

Android consumer paths now offer Fitbit burn + direct FatSecret intake or Fitbit burn
+ conditionally qualified exact-package Health Connect nutrition. Health Connect burn
is hidden and rejected by expenditure contracts. No active energy + BMR synthesis exists.

The server change is necessary: exact Android package identity is persisted independently
from Apple writer identity, including historical overrides and immutable calculation
provenance. The new authenticated intake endpoint validates one eight-date read generation
and calls the existing server finalization engine. Accounting formulas, the 80% adjustment,
Opening Bank selection, Recovery and Step Planning math were not changed.

This is **not mobile-only**. The additive migration/API must be deployed before a hosted
preview can select/upload native nutrition. Validation used only the dedicated local test database. The implementation commit
was subsequently pushed and Render auto-deployed it, including the configured
pre-deploy migration step. The dashboard confirms `89a80ce` as the live API commit
and latest successful lifecycle build; public API readiness returned HTTP 200.
No manual deployment or cron run was triggered.

Older iOS binaries do not recognize the new intake provider enum when the same account
selects Android nutrition. Existing iOS accounts/sources retain their behavior, but that
cross-device account scenario needs an explicit client compatibility strategy before
broader distribution. No iOS build or TestFlight change is included.

## Validation and QA limits

The full release gate passed with 760 tests across 66 files, including workspace/API/mobile
TypeScript, API/mobile lint, Prisma generation/validation, local migrations and API/domain
build. New tests cover exact origins, direct FatSecret deduplication, native consumer
normalization, denial/revocation, empty versus zero, source/account isolation, stale reads,
eight-date preparation, server Opening Bank use and the food selection/recovery screen.
Existing iOS, direct-provider and locked Step Planning regressions remain in the gate.
The existing Today hook-dependency lint warning remains (zero lint errors).

No physical device has been tested. Pending: populated/multiple writers, real revision
changes, exact-origin switching, account switching/deletion, both full onboarding paths,
Today/History, Step Planning keyboard/select-all and locked-card visual QA. Food-screen
checks do not certify those other screens. On Android 9–13, separately qualify standalone
Health Connect. Never log raw records or identity-linked calorie values.

Notification source code and server delivery semantics are unchanged. Startup did not
crash in notification code; permission/token generation, Firebase configuration, ownership,
sign-out cleanup, tap behavior and real Morning Bank Update delivery remain physical B4
qualification. No successful push delivery is claimed.

## Preview installation and B4

Use exactly one EAS `preview` Android APK in the existing project; no AAB, Play submission,
iOS build or TestFlight operation. The build must use hosted preview environment values,
never the temporary local test override. When available, testers install from the EAS page,
allow browser APK installation when Android asks, and use their own beta accounts.

Next task: resolve the Clerk registration blocker below using the existing APK, then
qualify it on a physical Android 14+ phone with Fitbit + FatSecret and
Fitbit + a verified exact-origin nutrition writer; exercise the complete account/source/
preparation matrix, locked Step Planning visuals and notification delivery. Resolve old
iOS-binary cross-device compatibility before widening distribution. Keep Health Connect
burn disabled and use the [physical script](../engineering/android-health-connect.md#ui-and-physical-script).

## Delivery record

- Implementation commit: `89a80cebe313bc1493b98e18a55b3455da4d026f`, pushed to
  `codex/private-beta-release`; 47 files changed.
- Exactly one Android EAS preview was requested: `c37e57fb-2031-41b1-8ccf-c4d88ad62110`.
- [Build/install page](https://expo.dev/accounts/philbk/projects/caloriebank/builds/c37e57fb-2031-41b1-8ccf-c4d88ad62110).
- Existing project `85fa9667-67bb-4d6c-bbcf-8f4e492ae5f5`, profile `preview`, internal
  distribution, APK, app version `1.0.0`, Android version code `1`.
- Android signing keystore generated and held by EAS; no signing secret was committed.
- Build status: **FINISHED**, completed 2026-09-12 at 04:04:01 UTC.
- [APK artifact](https://expo.dev/artifacts/eas/s6BAdavNQWi9LWmzxLMcHKQdGkT0YzX4qMcHMqoWRnk.apk).
  An unauthenticated raw download returned 403; authenticated `eas build:run --id
  c37e57fb-2031-41b1-8ccf-c4d88ad62110 --platform android` downloaded, installed
  and launched it successfully. Installer access may require the project’s Expo login.
- Local signed APK copy: `apps/mobile/build/caloriebank-b3-preview.apk` (ignored
  build artifact, not committed). Size: 128,295,889 bytes. APK signature verification passed.
- SHA-256: `642d147ed47c75b5d493a8f81dc3aa0f43e4b9518dc426d708f3d9abaa5666a3`.
- Signed-APK metadata verifies package `com.caloriebank.mobile`, minimum SDK 26,
  target SDK 36 and CalorieBank label. The seven Health Connect declarations are read-only.
- Signed-APK startup passed on AOSP and Google Play API 34 ARM64 emulators.
  Hosted sign-in failed on both; see the blocker below. No successful authenticated
  preview session or direct-provider OAuth completion is claimed.
- [Render API auto-deploy](https://dashboard.render.com/web/srv-dabhml4s728c739ut0k0/deploys/dep-daicjp2jnfac73e5ahk0)
  is live. [Lifecycle build](https://dashboard.render.com/cron/crn-dabhml4s728c739ut0l0/builds/bld-daicjpajnfac73e5ahvg)
  also succeeded at the implementation commit. The hourly schedule is unchanged.
- GitHub's unrelated Vercel status reports failure on both B2 and B3 commits.
  No Vercel configuration/deployment action was taken; it is not an Android gate result.
- No iOS EAS build, TestFlight operation, AAB or Play submission occurred.
- Until old-client compatibility is qualified, use an Android test account for
  Health Connect source selection rather than reusing it in the older iOS binary.

## Blocking hosted-auth configuration finding

Historical finding: registration is resolved by the authorized update below.

Read-only production Clerk inspection on 2026-09-12 confirmed Native API enabled,
**no Android applications registered**, and only `com.caloriebank.mobile://callback`
in the mobile SSO redirect allowlist. The signed APK contains the production Clerk
frontend domain. The installed Clerk Expo SDK uses
`clerk://com.caloriebank.mobile.hosted-callback` on Android; its config plugin is present.
[Clerk's hosted-auth requirements](https://clerk.com/docs/android/guides/account-portal/hosted-auth)
require native application registration in production. This is a concrete missing
prerequisite; the exact failing SDK response was not captured in the release binary.
Do not claim it is the only possible auth issue until a retry succeeds.

The second emulator uses `system-images;android-34;google_apis_playstore;arm64-v8a`
revision 14 and AVD `CalorieBank_B3_Google_API34`. Chrome's Custom Tabs service was
verified, Chrome first-run completed without an account, and the public Clerk HTTPS
endpoint loaded in Chrome. Sign in still returned “Sign-in could not be completed.
Please try again.” Therefore absence of an AOSP browser is not the complete explanation.
No credentials were entered, no account was created, and no production Clerk settings
were changed. The earlier B1 instruction explicitly prohibits production Clerk changes.

Concrete configuration needed for an authorized follow-up:

- Android namespace/package: `com.caloriebank.mobile`.
- Signed preview certificate SHA-256 (public certificate fingerprint, not a secret):
  `F2:EE:9D:25:B3:E5:E5:54:74:72:50:B1:43:FC:42:2D:96:5A:CD:8D:08:BB:AD:59:87:FB:9B:B4:CC:9C:17:5C`.
- Android Expo hosted callback: `clerk://com.caloriebank.mobile.hosted-callback`.
- Add only the Android registration/required redirect; preserve the existing iOS entry.
- Retry sign-in/sign-up, callback/session restoration and sign-out on this same APK.
  Do not create another preview merely to change server-side registration.

**Original B3 verdict (before the authorized registration below): BLOCKED — production Clerk Android registration is
missing and signed-preview hosted authentication fails.** The APK is available for
qualification, but is not yet certified for Friends & Family use. After authentication
is unblocked, perform the physical B4 matrix and resolve older iOS-client cross-device
compatibility before broadening distribution.


## Production Clerk Android registration — 2026-09-12

The user explicitly authorized the Android-only production Clerk configuration change.
Used existing CalorieBank production instance `ins_3IvHinkRrGUSICIJGXNKNlg8V61`
in application `app_3I9crm3sapi9U7WbUXpbd0o0DI9`; no second instance was created.
Frontend API remains `clerk.caloriebank.philbk.dev`. Native API was already enabled.

Registered Android namespace `android_app`, package `com.caloriebank.mobile`, with
the existing signed APK certificate fingerprint recorded above. Verified the saved
registration in the dashboard and its public `/.well-known/assetlinks.json` output.
Added the exact Expo SDK callback `clerk://com.caloriebank.mobile.hosted-callback`.
Clerk automatically added `clerk://com.caloriebank.mobile.callback` when registering
Android; both are exact URLs, with no wildcard. The existing iOS registration
`5HQ8A8X5Z8` / `com.caloriebank.mobile` and `com.caloriebank.mobile://callback`
were rechecked and preserved. No keys were regenerated, no email authentication
settings or existing user records were manually changed.

Existing B3 APK remains valid. No replacement Android build was created. Retested
build `c37e57fb-2031-41b1-8ccf-c4d88ad62110` on the existing Google Play API 34
ARM64 emulator. The former immediate hosted-auth error is gone: Sign in opens
`accounts.caloriebank.philbk.dev` in the browser. Initially it displayed Cloudflare
security verification. Full email verification, return/session, protected API and
account-switch qualification require completion of that page and controlled test
account access; do not infer those results from browser launch alone.


Current verification limit: the page progressed to an explicit “Verify you are human”
Cloudflare challenge. No attempt was made to automate or bypass that challenge. The
emulator was made visible for user completion, and disposable test-email access was
requested. Sign-up, sign-in completion, callback return, sign-out, restore, protected
`/v1/me` requests, Account A/B isolation and deletion remain **pending**, not passed.
No physical Android phone was available. Neither provider combination nor push
registration/delivery was newly qualified in this configuration-only task. Health
Connect burn remains disabled. Render, PostgreSQL, migrations, accounting, Fitbit,
FatSecret, notifications, Apple Health and TestFlight were untouched.

Next: complete the human check and controlled email-code authentication on the same
APK, then test session/API/account isolation and the existing physical qualification
matrix. No rebuild is needed for the saved Clerk registration. Current task verdict:
**ANDROID B3: BLOCKED — human verification and test-account authentication pending.**
This supersedes the earlier missing-registration blocker; Android registration itself
is complete and verified.


## Observed authenticated callback defect — 2026-09-12

This later retest supersedes the pending-human-verification status above. The user
completed browser verification and supplied a controlled existing-account email and
one-time code. Neither is retained in this document.

Observed on the same signed B3 APK and API 34 Google Play emulator:

- A previously established authenticated session survived force-stop/relaunch and
  rendered Today. Normal Settings sign-out returned to Sign In.
- A fresh Sign In opened the CalorieBank hosted page. The existing email was
  recognized. “Use another method” exposed the unchanged email-code method.
- Submitting the user-supplied code authenticated successfully and returned from
  Chrome into the native application, but Expo Router showed **Unmatched Route**.
- The unmatched path was `com.caloriebank.mobile.hosted-callback`, displayed under
  the app's `caloriebank://` scheme by Router. Authentication query parameters were
  present; they are deliberately omitted here and must never be copied to diagnostics.
- Force-stop/relaunch then restored the new authenticated session and loaded Today
  and Available Bank without a sign-in or bootstrap error. This is UI-level evidence
  that the protected onboarding/Today API path accepted the session; no bearer token
  was extracted and no raw HTTP response/status was instrumented.

The production Clerk registration now matches the compiled callback. The remaining
failure is app-side routing of the callback as a screen; changing the allowlist again
is not the remedy. There is no `+native-intent` callback normalization boundary in
this binary. A narrowly scoped Android callback-routing fix must retain Clerk's
state/nonce verification and leave iOS/provider callbacks unchanged. Investigate the
account-keyed navigation remount as part of that fix; do not claim a specific race
mechanism was proven solely from the screen.

Per the user's stop-before-rebuilding instruction, no product code was edited and
no replacement build was requested. The existing APK is valid for authentication
configuration and session restoration, but **does not pass the complete return UX**.
Fresh sign-up, second-account isolation, deletion, physical provider combinations,
notification token ownership and delivery remain unqualified. No account was deleted.

One emulator retry also encountered Chrome 113's `CompositorGpuTh` SIGSEGV with the
software renderer. Restarting this task's emulator with its documented `-gpu auto`
option allowed the hosted page to load. This is local toolchain evidence, not an app
code change or physical-device result.

Current verdict: **ANDROID B3: BLOCKED — authenticated Android hosted callback is
routed to Unmatched Route; a minimal app-side routing fix and subsequent binary
qualification are required.** Next task: implement and test exact Android hosted-
callback normalization, preserve iOS and other deep links, then seek the separately
required replacement-preview decision and repeat the full return/session tests.


## Android callback routing fix — 2026-09-12

The incoming SDK callback contract is scheme `clerk`, host
`com.caloriebank.mobile.hosted-callback`, empty path (a trailing slash is accepted),
and query keys `created_session_id`, `rotating_token_nonce`, `state`. Values are
credentials/session-bound evidence and are never documented or logged. The Router
error displayed a reconstructed `caloriebank://` URL; that is not a different Clerk
registration requirement.

Root cause was reproduced against installed Expo Router 6's
`extractExpoPathFromURL`: for custom schemes it concatenates host and pathname,
so the Clerk callback becomes the nonexistent screen
`com.caloriebank.mobile.hosted-callback`. Router and Expo WebBrowser both subscribe
to the native URL event. Clerk verifies the callback and activates its session, but
ordinary Router navigation also receives that authentication transport URL.

The minimal fix adds `app/+native-intent.ts` and a pure Android-only normalizer.
Only `clerk://com.caloriebank.mobile.hosted-callback` with no additional path is
intercepted. A warm callback returns an empty Router destination: Router 6's
subscription deliberately dispatches only truthy destinations, keeping the screen
awaiting Clerk mounted. Clerk's existing state/PKCE/nonce checks and completion
navigation remain responsible for success. A cold callback maps to `/`, where the
existing gate waits for Clerk hydration and uses only the restored active session.
A cold process without that session must sign in again; URL parameters never grant
access or reconstruct a lost PKCE exchange. Duplicate/stale callbacks carry no
navigation/auth ownership state in this hook. Current Clerk/account-generation
protections are unchanged.

This is not a callback screen, wildcard route or auth redesign. iOS/web links pass
through byte-for-byte. Fitbit/FatSecret `caloriebank://integrations` callbacks,
notification destinations, ordinary routes and normal launch remain untouched.
The hook does not mutate the original URL received by Clerk, call session APIs,
cache callback parameters or add timeouts. Cancelled/invalid callbacks cannot confer
authentication and never become a technical callback screen.

Validation and replacement-build results will be recorded below. Both Expo platform
configurations compare equal to B3. No native dependency/config change is needed.
The local machine has insufficient free disk to safely reconstruct the cleared
Gradle/native caches while preserving the test emulator. Android native compilation
for this replacement is therefore to be verified by the one authorized EAS preview
build, not claimed from a skipped local compile. Production Clerk, backend, Render,
iOS/TestFlight and all health/accounting/source logic are unchanged.

Pre-build validation passed: full `release:friends-family`, 788 tests / 67 files
(28 new callback cases), workspace/mobile/API TypeScript, API/mobile lint (one
pre-existing warning), API/domain builds, dedicated local test Prisma gate, Expo
Android export/configuration, iOS configuration and dependency validation. No backend
implementation changed. Autolinking retains the platform-specific health boundaries.


### Replacement APK delivery and current retest

Exactly one replacement preview was created:
`99a064c9-d1ce-4a38-a879-22a898fd4bae`, source commit
`d8ab32810575b327085ab6c0b32a9d35682c01d5`.
[Build/install page](https://expo.dev/accounts/philbk/projects/caloriebank/builds/99a064c9-d1ce-4a38-a879-22a898fd4bae).
[APK artifact](https://expo.dev/artifacts/eas/RNBGyvf9ah7OMD_T3naoqONfe3x02PraioXpVvj-ncs.apk).
The existing project, preview environment and Android keystore were reused. No Clerk
registration change, iOS build, AAB, Play submission or Render deployment was made.

EAS status **FINISHED**, 2026-09-12 20:24:07 UTC. Native Gradle build:
**BUILD SUCCESSFUL in 20m 30s; 962 actionable tasks, 962 executed**. This is cloud
native compilation; local compilation was not rerun due to disk headroom. The
Android Hermes export also passed before submission. Signed APK downloaded through
`eas build:run`, installed over the previous binary and launched successfully.

Local artifact: `apps/mobile/build/caloriebank-b3-callback-fixed.apk` (ignored),
128,296,589 bytes, SHA-256
`769c4b209a2f0ebc044b485a0db4bdb53b1032a32dcdca6c4ac4eb8422441fcc`.
APK signature verified; certificate fingerprint matches the registered B3 keystore.

Actually exercised on the replacement, Google Play API 34 ARM64 emulator:

- Installation preserved the existing session and loaded Today/Available Bank.
- Normal Settings sign-out returned to Sign In.
- Sent duplicate warm synthetic cancelled callbacks, then a cold cancelled callback;
  the resulting signed-out app showed Sign In, no unmatched route and no session.
  These are synthetic routing checks, not successful-auth evidence.
- A fresh real Sign In opened the hosted site but encountered another Cloudflare
  human-verification challenge. User completion is required before the fresh code
  and immediate return can be qualified. Do not automate/bypass the challenge.

No physical Android phone was used. Fresh successful callback, second sign-in,
post-auth relaunch and Account A/B switching on this replacement remain pending
at this checkpoint. Previous-binary auth successes are not replacement qualification.
A second controlled email was requested for Account B; no account was deleted or
provider authority changed. Health Connect burn remains disabled.


### Successful replacement callback retest

After the user completed Cloudflare and entered a fresh email code for controlled
Account A, the replacement returned directly into `com.caloriebank.mobile` and
rendered Today/Available Bank. No manual relaunch occurred before this observation;
no Unmatched Route, email prompt or sign-in screen remained. A subsequent explicit
force-stop/relaunch restored the authenticated session and Today successfully.
Normal Settings sign-out then returned to Sign In with no Today state visible.

While Account A was authenticated, duplicate warm callback intents carrying a
synthetic invalid `created_session_id` left the current Today screen intact with
no unmatched route or sign-in transition. No real authentication parameters were
replayed or logged. This is invalid-link routing evidence, not proof of accepting
an old valid nonce. Clerk's existing verification remains authoritative.

A second user-controlled existing account was then entered from the signed-out
state. Its existing email-code method was selected; Account B verification is
pending at this checkpoint. Both accounts already existed; no fresh sign-up or
account deletion is claimed. No provider connection/authority or health data was
manually changed.


### Final callback qualification — PASS

**ANDROID B3 CALLBACK FIX: PASS — AUTH FLOW READY** (emulator-qualified, not full
physical Friends & Family certification).

Replacement build `99a064c9-d1ce-4a38-a879-22a898fd4bae` / source
`d8ab32810575b327085ab6c0b32a9d35682c01d5` completed these actual tests:

| Test | Result |
| --- | --- |
| Existing session retained across APK update | Passed; Today rendered |
| Account A fresh email-code sign-in | Passed; browser returned directly to native Today, no relaunch/unmatched route |
| Account A session restore | Passed after force-stop/relaunch |
| Account A normal sign-out | Passed; Sign In displayed, Today absent |
| Account B sign-in after Account A sign-out | Passed with separately supplied email/code; direct native Today, no unmatched route |
| Account B session restore | Passed after force-stop/relaunch |
| Duplicate invalid warm callback | Passed; no route/session transition observed |
| Cold cancelled callback while signed out | Passed; Sign In, no authenticated access/unmatched route |
| Invalid stale-account callback fixture after B sign-in | Passed; current app remained on Today |

The two real hosted flows used distinct user-controlled existing accounts. The
account-switch result is an end-to-end UI check, backed by the unchanged account-
generation/ownership regression suite; no raw token, internal account ID or private
API response was extracted. This does not claim a replay of an old valid nonce,
exhaustive data-leak instrumentation, fresh-account signup, physical-phone testing
or real provider OAuth/notification delivery. Both real flows used Clerk's normal
email-code verification. No production Clerk settings were altered for this fix.

All source validation remains the successful 788-test / 67-file release gate and
native EAS build recorded above. Subsequent changes are documentation only; link
checks and `git diff --check` pass. iOS configuration and URL behavior are unchanged;
iOS physical auth was not rerun. Fitbit/FatSecret callbacks and notification links
pass through unchanged in regression tests; their real external OAuth/delivery was
not repeated. HealthKit, Health Connect, burn qualification, accounting, Opening
Bank, ledger and notification implementation remain untouched. No additional APK,
iOS build, Play submission, Render deployment or TestFlight operation occurred.

Next phase: use this replacement APK for physical Android B3/B4 qualification of
Fitbit + direct FatSecret and Fitbit + exact-origin Health Connect nutrition,
including permissions/history/source switching, onboarding, locked Step Planning,
notification ownership/delivery and deletion on a separately confirmed disposable
account. Keep Health Connect burn disabled. Preserve the documented older-iOS-client
cross-device compatibility gate before broad distribution.


## Pixel 9a physical qualification — 2026-09-12

Real Google Pixel 9a, Android 16 / API 36, Google Play Services present,
system-integrated Health Connect (`com.google.android.healthconnect.controller`).
Display 1080 × 2424, density 420 dpi, original font scale 1.0. No device identifiers,
raw records, food details or calorie amounts are retained in this report.

### Build and reproduced fix

Initial physical tests used `99a064c9-d1ce-4a38-a879-22a898fd4bae`.
Cronometer exported 17 nutrition records, exact origin `com.cronometer.android.gold`,
with a complete stable query for September 5–12. Today was rejected as
`ambiguous_overlap`; seven earlier dates were empty. The founder independently
confirmed the Health Connect total matched Cronometer and entries were separate
foods, not duplicate copies.

The Android normalizer incorrectly applied continuous-interval overlap rejection to
food items. It now accepts additive nutrition intervals after exact-origin ID/revision
deduplication. Missing energy, conflicting revisions and midnight boundaries remain
guarded; steps/workouts/energy overlap policy and Health Connect burn are unchanged.
Android's [NutritionRecord contract](https://developer.android.com/reference/androidx/health/connect/client/records/NutritionRecord)
allows meals or individual foods. Writer-created duplicates with different IDs cannot
be inferred from time alone and remain a writer-quality limitation.

Fix commit `0e59e0d49ef2978ac2048fcaf441af38140bb1c0` was pushed to
`codex/private-beta-release` with `[skip render]`. Exactly one replacement APK:
[`6175d2d0-a0d5-4ee5-9230-e3f283fbaa60`](https://expo.dev/accounts/philbk/projects/caloriebank/builds/6175d2d0-a0d5-4ee5-9230-e3f283fbaa60).
Finished 2026-09-13 02:36:49 UTC; cloud Gradle **BUILD SUCCESSFUL in 22m 51s**.
Downloaded via authenticated EAS, apksigner verified the same existing certificate,
and `adb install -r` succeeded on the Pixel. Authenticated Today survived upgrade.

APK SHA-256: `30405abc371b3f6fdb632c513486c4366a67f85dd1e51bcc264ab83f2004ed93`.
Certificate SHA-256: `F2:EE:9D:25:B3:E5:E5:54:74:72:50:B1:43:FC:42:2D:96:5A:CD:8D:08:BB:AD:59:87:FB:9B:B4:CC:9C:17:5C`.
Local artifact: `apps/mobile/build/caloriebank-b3-physical-fixed.apk` (ignored).

### Physical results, separate from earlier emulator evidence

| Check | Actual result |
| --- | --- |
| Installation/startup | Both signed APKs installed and launched; corrected update preserved session. |
| Production Clerk | Email-code browser return directly to Today, no unmatched route/manual relaunch; session restore and sign-out passed. |
| Fitbit | Initial OAuth tester restriction reproduced. Founder-approved account added to existing Google project `caloriebank-505623`, verified five testers and Testing status unchanged. Reauthorization then returned directly to Connected/Selected Fitbit. |
| Direct FatSecret | Browser return passed; Connected intake alongside Fitbit burn; truthful no-intake-today state. |
| Historical direct data | Initial uncalculated view resolved after processing. September 8/9 calculated entries appeared; September 10/11 showed food unavailable. September 8 detail explicitly attributed Fitbit burn and FatSecret intake. No fresh-account Opening Bank claim. |
| Step Planning | Both locked result sequences present. Walking input typing replaced selected value; original restored. Keyboard dismissal and Back worked. Full keyboard visibility/burn-input coverage remains pending. |
| Nutrition permission | Consumer prompt requested Nutrition only, described prior 30-day access. Denial/re-request/grant passed. Empty discovery was truthful. |
| Revocation | OS settings link worked; revoked Nutrition returned to Allow food access. Re-grant rediscovered Cronometer. FatSecret authority remained selected during this test. |
| Cronometer export | Official app installed/signed in by founder. Only WRITE_NUTRITION granted; other health categories off. Exact package discovered. No invented food entries. |
| Corrected nutrition | Same source now reports connected; Today has numeric Eaten and Imported from Cronometer while burn remains Fitbit. Founder confirmed displayed intake matches Cronometer (whole-calorie precision). Full relaunch retained the session and Cronometer intake. |
| Source switching | FatSecret → Cronometer → FatSecret persisted explicitly on old APK; Fitbit remained connected. Corrected APK Cronometer selection succeeded. |
| Account isolation | Account B email-code return passed; no Account A connected sources or Fitbit/FatSecret/Cronometer authority inherited. OS nutrition permission remained device-owned. |
| Deletion | Founder-designated disposable CalorieBank account deleted via DELETE confirmation; returned to Sign In and remained signed out after relaunch. No connected provider/push tokens on that account, so their deletion cleanup is not physically proven. Founder/provider accounts untouched. |
| Notifications | Permission prompt/grant passed; registration failed safely, preference remained Off with retry. Token ownership and delivery unqualified; B4 prerequisite. |
| Layout | Default-font sign-in and historical details inspected; no observed overlap there. At 1.3 font scale, in-process changes briefly caused stale text measurements; clean relaunch corrected Today main cards/navigation. Restored 1.0. Full enlarged-text/TalkBack matrix pending. |

One initial corrected-APK food discovery failed transiently; explicit Find food
trackers retry succeeded. Record this for follow-up; no root cause established.
Foreground entry triggered food discovery, but provider-value-change/race tests and
forecast-stability physical qualification are incomplete.

### Validation and remaining qualification

`release:friends-family` passed: **790 tests / 67 suites**, workspace/API/mobile
TypeScript, API/mobile lint (one pre-existing Today hook warning), localhost Prisma
generation/validation/migration, API/domain build, `git diff --check`.
Targeted qualification/client suites: 35 tests. Regressions cover overlapping foods,
repeated IDs, revisions, other-origin exclusion, conflicting revisions and missing
energy. Expo config resolved both platform IDs unchanged; online dependency check,
autolinking verification and Android prebuild passed. About 5.5 GB free locally
prevented a prudent full local native rebuild; cloud compile success is recorded
above and is not described as a local compile.

Pending: historical Cronometer backfill,
multiple populated writers and wrong-writer exclusion, active-selected-source
revocation, fresh-account onboarding/preparation, provider cleanup with active
tokens, notification registration/delivery, full keyboard/font/TalkBack matrix and
foreground race/forecast tests. Health Connect burn **remains disabled**.
No API implementation/schema/accounting/iOS changes, Render deployment, TestFlight
operation, AAB or Play submission. Next phase: finish corrected-APK physical
nutrition checks, then B4 notification infrastructure and remaining physical gates.


**ANDROID B3 PHYSICAL QUALIFICATION: PASS CANDIDATE — notification registration,
historical/multiple-writer nutrition, fresh setup and extended physical QA remain.**
The exact next task is B4: resolve Android notification registration using verified
FCM configuration, then complete the outstanding physical matrix on this APK where
possible. Do not enable Health Connect burn or reopen initialized Opening Banks.
No additional replacement build was submitted.

## B4 notification infrastructure — 2026-09-13 (qualification in progress)

The installed B3 APK `6175d2d0-a0d5-4ee5-9230-e3f283fbaa60` has no compiled
`google_app_id` or `gcm_defaultSenderId` resources. Its Expo Android configuration
had no `googleServicesFile`. This is a native FCM initialization prerequisite
failure before obtaining the Expo token and registering it with the API; physical
registration/delivery are not yet claimed successful.

With explicit account-holder authorization, Firebase was attached to the existing
Google Cloud project `caloriebank-505623` (no new project), and Android package
`com.caloriebank.mobile` was registered. Optional Google Analytics was disabled.
Existing OAuth configuration and unrelated credentials were not edited.

The dedicated `caloriebank-expo-fcm` service account was assigned only Firebase
Cloud Messaging API Admin. EAS confirmed upload and FCM V1 assignment for
`com.caloriebank.mobile` in the existing CalorieBank Expo project
`85fa9667-67bb-4d6c-bbcf-8f4e492ae5f5`. The temporary downloaded private-key file was
deleted immediately after that confirmation. No private key was placed in the
repository, application configuration, environment files, or application bundle.

`apps/mobile/google-services.json` is the separate Android client configuration,
not a service-account credential. Expo's `android.googleServicesFile` now points
to it. Android prebuild copies it and applies the Google Services Gradle plugin.
No additional SDK dependency or iOS configuration change is needed.
See [Expo's FCM setup](https://docs.expo.dev/push-notifications/fcm-credentials/).

Physical B4 push-token, account ownership, delivery/tap, revocation, and deletion
checks remain pending. The Pixel was not connected to ADB during this setup.
No B4 EAS build has yet been created; group remaining necessary fixes and validate
before using the single permitted replacement APK. Render and TestFlight remain
untouched. Health Connect burn remains disabled.

Setup validation: `release:friends-family` passed with 791 tests across 67 files,
workspace/API/mobile TypeScript, API/mobile lint (one pre-existing Today hook
warning), localhost Prisma generation/validation/migrations, and production
API/domain builds. Expo public config resolved both unchanged application IDs;
Expo dependency validation, autolinking verification, Android prebuild, and
`git diff --check` passed. The Firebase configuration regression checks exact
Android package/project matching and excludes server private-key material.
Native compilation and physical FCM registration remain pending for the grouped
B4 replacement build; prebuild is not a native compile.

### B4 fresh-account physical progress — 2026-09-13

On the reconnected Pixel 9a, a newly recreated disposable CalorieBank/Clerk
identity completed production email verification and returned to the welcome
screen. The underlying Google/Gmail identity was not changed. The five-step
journey exposed Fitbit only for burn, then direct FatSecret or Health Connect
food for intake. Fitbit connected; the callback opened Health Connections, and
Android Back resumed the food step (an extra navigation step, not a blocked
journey). Cronometer was explicitly selected for this new account. Maintain was
selected for the disposable test goal, and Daily Bank Target was configured.

Preparation first truthfully showed Fitbit waiting and Cronometer checked, then
completed without a manual retry, showing “Your bank is ready” and a starting
balance. This proves fresh physical journey completion; independent verification
of all persisted historical dates and the Opening Bank calculation is still
pending. No on-device accounting was introduced. Notification enablement is held
until installing the Firebase-enabled APK.

The one B4 preview build is `72fa526a-f335-4fd8-b88c-65067b1a0911`, source
`c2ab1657af7d5355693a9f7168fa5f84fdc4b59f`, submitted after the 791-test release
gate passed. Native Gradle compilation passed (`BUILD SUCCESSFUL`, `:app:assembleRelease`),
and the APK was downloaded through EAS and installed over the existing app on the
Pixel (`adb install -r`: Success), preserving the disposable account session.


### B4 physical notification registration — 2026-09-13

On B4 build `72fa526a-f335-4fd8-b88c-65067b1a0911`, the recreated disposable
account enabled Morning Bank Update from setup. The UI showed ENABLED; the normal
implementation only returns that success after Expo-token generation,
authenticated device registration, and preference persistence. After full
force-stop/relaunch, authenticated Today loaded and notification Settings fetched
On. This qualifies the client/API registration path, without logging the token
or claiming independent database inspection or push delivery.

Android notification permission was then revoked through system UI. Android
recreated the app, which retained the disposable session. Attempting enablement
showed the OS permission prompt; choosing Don't allow produced truthful Android
Settings copy and an Open Notification Settings action. That action opened the
CalorieBank app-info page, with Notifications one additional tap away. After
restoring permission, app retry refreshed the state; enabling again succeeded
and showed On. Three rapid background/foreground cycles preserved the screen and
On state with no observed crash. This is not proof of every stale-response or
manual-refresh race; automated coverage remains separate.

Real delivery, notification tap, cross-account token ownership and deletion with
an active token remain pending. At this test it was 13:22 America/Chicago, outside
the unchanged morning window. No clock/timezone/eligibility override or test bypass
was introduced. Keep the disposable identity available for real morning delivery
before deleting it. No primary-account settings, Google/Gmail identity, Render,
TestFlight, Health Connect burn authority, or accounting code were changed.

### B4 return sign-in and native history check — 2026-09-13

Following the authorized account-switch sequence, the user completed the return
sign-in on the Pixel. Today loaded and Morning Bank Update fetched On. Both
preceding normal sign-outs returned to authentication successfully. This is UI/API
registration evidence, not independent database token-owner inspection or proof
that an old account cannot receive a push. Real delivery/tap and token-aware
disposable-account deletion remain pending; retain the disposable identity for
that qualification. No primary-account provider selections were changed.

Nutrition-only read-only diagnostics reported available with no missing required
permissions. Explicit diagnostic selection of `com.cronometer.android.gold`
returned complete, origin observed, stable_read for September 6–13: 17 nutrition
records, usable evidence on September 12, and empty on the other seven dates.
This diagnostic does not upload records or change server selections. Persisted
aggregate matching, physical multiple-writer isolation, and DST remain separate
checks. Forecast use stayed disabled and full-day burn NOT QUALIFIED.

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

### B4 remote push transport physically confirmed — September 16 (Chicago)

A single founder-authorized test used the deployed `ExpoPushTransport` from a
one-time Render shell command, with title CalorieBank and test-specific body
Android notification test. No scheduled delivery service, eligibility bypass,
public endpoint, database mutation, deployment or application change was used.
A create-exclusive attempt marker prevented accidental command replay; exactly
one token and one send attempt were reported. The token remained server-side.

Ownership was verified by a scoped database read and correlation: the same active,
non-invalidated Android registration under the previously authorized disposable
account advanced from 00:27:48.981Z to 00:30:47.157Z on September 17 UTC when the
Pixel was explicitly foregrounded. This differed from the founder's initially
reported primary email; no primary-account registration was selected. The send
rechecked the account/token fingerprints, recent registration and global token
uniqueness before delivery. No other recipient was targeted. This verifies the
current registration, not every account-transfer race or former-owner cleanup.

Expo accepted ticket `01a0acc7-389b-75fa-ab15-c9180e6fc7c3`; subsequent receipt
was `ok`. The founder confirmed the notification appeared on the physical Pixel
and tapping it opened CalorieBank normally. Post-tap account identity and absence
of duplicate physical notifications were not separately confirmed. No second
send was made. This qualifies real Expo/FCM transport and normal tap opening,
not scheduled morning eligibility, finalized-day copy, or exactly-once delivery.
The planned emoji was not visible in shell accessibility output; exact emoji
rendering on the phone was not independently recorded.

No APK, EAS build, Render deployment, TestFlight change, or permanent config/code
change occurred. Health Connect burn remains disabled. Remaining B4 gates include
token-aware deletion, account-transfer safety, physical refresh races, accessibility
and outstanding multi-writer coverage.

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

### Foreground/race qualification — September 17: in progress

Pixel 9a / Android 16, existing APK unchanged. The baseline account's Fitbit
connection reported `needs_reconnect` / `access_revoked`; the founder reconnected
through the normal UI. Read-only server verification then showed connected with
no error. Subsequent foreground Fitbit and Health Connect sessions completed.
The founder performed manual-refresh/background overlap and short rapid returns
and reported no stuck spinner, blank values, error or crash. Two observed manual
Fitbit sessions ran serially at 17:43:08.826–17:43:23.134Z and
17:43:25.911–17:43:39.005Z, both completed without error. This is session evidence,
not a complete count of client logical refreshes or proof of every race.

During these checks Today showed no intake despite food logged on the iPhone.
Before opening Android Cronometer, the existing nutrition-only diagnostic queried
September 10–17: availability available, missing permissions none, exact selected
package `com.cronometer.android.gold`, origin observed, stable_read, 85 nutrition
records in the window. September 17 was empty; September 12–16 had usable evidence.
The founder then opened/refreshed today's diary in Android Cronometer and returned
to CalorieBank, confirming Eaten matched. This repeats the observed cross-device
export gap and empty-to-populated recovery; it is not evidence of failed reading
of existing Health Connect records. No diary contents or calorie amounts recorded.

Existing foreground coordinator and Health Connect qualification suites passed:
36 tests across 2 files under Node 20. Physical offline recovery, sign-out around
refresh, new account-switch race and final Step Planning checks remain pending.
No overall foreground/race PASS yet. No code/config change, build or deployment.
Health Connect burn remains disabled.

#### Offline Banking Goal detail defect — reproduced September 17

The founder confirmed established Burned/Eaten/Steps remain visible offline.
Inside Banking Goal (after tapping the Today card), however, the spinner remained
for more than 30 seconds with no error, and recovered only when internet returned.
A deterministic request test reproduced the deadline gap: the existing 20-second
AbortController deadline aborted fetch but did not settle a pending Clerk token
lookup. The exact native Clerk internal wait was not instrumented on the phone.

The shared request now races both token lookup and fetch against the existing
deadline, preserves account-generation checks, and cannot send a late token after
timeout. Banking Goal has a separate load-error state: “Couldn’t load your Banking
Goal. Check your internet connection and try again.” / “Try again”. It does not
show an editable blank plan when loading fails. No accounting, provider, native
permission, notification, or iOS-specific configuration change. Both platforms
receive the bounded-request/error-recovery safety fix; successful flows remain
unchanged. Five regressions cover pending token, late token/retry, stalled fetch,
account switch, and rendered failure/retry without a write.

Replacement-APK visual/physical checks of this fix remain pending, including
offline timeout, retry after restoring internet, narrow/enlarged-text layout and
existing-account goal rendering. Do not treat source-level or renderer tests as
physical qualification. No replacement build has been created for this fix.

Fix validation: `release:friends-family` passed with 796 tests across 69 files,
workspace/API/mobile TypeScript, API/mobile lint (one existing Today hook warning),
dedicated localhost Prisma generation/validation/migrations, API/domain builds,
and diff checks. Expo public configuration retains both package/bundle IDs;
autolinking verification passed. Expo dependency check used its local SDK map
because network access was disabled, reporting up to date; online verification
was not claimed. Native compilation and updated-APK visual QA were not run.
