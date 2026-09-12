# Android B3 local qualification

Work started from `df792a9017eaf3a5d30f27f7ee0103926e5818cd` on 2026-09-11.
B3 implements the nutrition consumer path and has passed native compilation and
emulator startup. The production Clerk Android registration was added on 2026-09-12;
see the auth-unblock verification record below. End-to-end authentication is still being qualified. Physical QA remains pending. Health Connect burn remains disabled.
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
