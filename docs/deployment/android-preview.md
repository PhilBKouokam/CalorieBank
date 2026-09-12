# Android B3 local qualification

Work started from `df792a9017eaf3a5d30f27f7ee0103926e5818cd` on 2026-09-11.
B3 implements the nutrition consumer path and has passed native compilation and
emulator startup. Physical QA remains pending. Health Connect burn remains disabled.
The preview build delivery record will be appended after the single authorized build.

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
the cache resolved both. No compiler incompatibility was bypassed. The final debug APK
is generated under `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
The final APK was compiled after the emulator tests; the nutrition JavaScript flow
was exercised through Metro on the earlier successful native binary. No physical
startup or installation of the eventual remote preview is claimed.

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
  was removed after these checks to recover disk space for native compilation;
  JDK, SDK platform/build tools, NDK and adb remain in the isolated toolchain.

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
preview can select/upload native nutrition. Only the dedicated local test database has
been migrated during validation. A push to the existing release branch may trigger the
existing Render auto-deployment; do not claim Render is untouched after that push without
checking delivery. No manual Render deployment has been performed during implementation.

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

Next task: qualify the APK on a physical Android 14+ phone with Fitbit + FatSecret and
Fitbit + a verified exact-origin nutrition writer; exercise the complete account/source/
preparation matrix, locked Step Planning visuals and notification delivery. Resolve old
iOS-binary cross-device compatibility before widening distribution. Keep Health Connect
burn disabled and use the [physical script](../engineering/android-health-connect.md#ui-and-physical-script).
