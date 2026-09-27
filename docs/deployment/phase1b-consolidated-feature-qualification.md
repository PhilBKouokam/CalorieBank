# Phase 1B consolidated feature qualification — September 25, 2026

Status: **PRE-ENABLEMENT ARTIFACT GATE FAILED — iPhone Back chevron remains too low.**
Manual Intake enrollment remains disabled. Android delivery and qualification are complete for the single authorized build;
no replacement job is authorized here. Final verification completed September 26
(America/Chicago), September 27 UTC.
This continues the passed pre-enablement checkpoint at `37b932d`; it does not
restart Phase 1A, reopen the non-blocking Fitbit investigation, or grant Phase 1B PASS.

## Validated source and build submissions

Both feature jobs use clean source commit
`37b932de4fb3e20c904918d916872350b38a46f2` on `codex/private-beta-release`.
This includes the committed iOS native Back-wrapper correction from `4fd624f` and
the capability-emitting manual client. No implementation changes were made.

Local `release:friends-family` passed under Node **20.20.2**: **939 tests / 87 files**,
workspace type checks and lint, Prisma generate/validate/deploy, API/domain/schema
builds, and `git diff --check`. Tests used only the existing dedicated localhost
`caloriebank_test_phase1b_20260923` database. The initial sandbox invocation could
not open the test-runner socket; the next attempt used the default local database
role and stopped at migration-table permissions. The final successful run used
the verified existing owner, `kouok`, with both database environment variables
pointing to the isolated database. No database grants or product changes were needed.
Expo dependency validation passed. Existing release profiles were inspected before
submission; both use beta/Clerk, store distribution and qualification flag `0`.

Exactly one job was submitted per platform:

| Platform | Version | Profile | EAS build |
| --- | --- | --- | --- |
| iOS | 1.0.0 (8) | testflight | `d15ce476-8065-4222-996a-b832b97f6d6e` |
| Android | 1.0.0 / versionCode 7 | play-testing (AAB) | `c53e4e24-bf1c-4cf3-a2b9-c810840b68fc` |

Both EAS records identify the source commit above. Cloud logs show Node **20.19.4**
and execution of the pinned Back patch during postinstall. No credentials were
regenerated and no additional build was requested.

iOS finished at **2026-09-26T00:22:36.573Z**. Exact IPA inspection confirms
`com.caloriebank.mobile`, version 1.0.0, build 8, unchanged encryption declaration,
`intake-authority-v2` in the JS bundle and `cb_centeredBackBarItemView` in the native
executable. The latter is compiled correction evidence, not physical visual PASS.

- IPA SHA-256: `8e71c706a7e6d8e7049b82ec70826d9ded1df6244cf1bad97e0c5e0e88fb9569`
- JS bundle SHA-256: `b8878847fcb08a004ce216c9e89117b0e5823ec47c2e5154137b4d49c538fb63`
- EAS iOS submission: `f3df1dc4-91a4-4cb8-a2d2-584425158df7` (upload succeeded).

Apple completed processing and accepted build 8 for the existing Friends & Family
group. App Store Connect build `7fc9b2b3-61c9-4542-8df2-afb086465fbb` shows
**Testing** in that group. Existing tester notifications were included in the
authorized private distribution; no testers or public links were added.

Founder confirmed TestFlight build 8 installed and a clean startup: existing
account/bank returned without transient disconnected, review-connections or error
states. On Health Connections, founder physical inspection of installed build 8 **FAILED**
the Back visual check: the chevron is still too low. Compiled wrapper presence and
prior geometry tests do not override this actual-device result. No UIKit hierarchy
inspection or root cause has been established. No speculative patch or extra build
was created. Founder also confirmed Back navigation returns to Settings normally and the
Calories Eaten chooser shows Cronometer once with the correct existing selection.
Founder confirmed normal completed History without new warnings. For live
capability qualification, the installed build opened `caloriebank://manual-estimate`
and displayed “Your calorie source changed. Go back and try again.” This branch
runs only after `fetchManualIntake()` successfully parses the protected GET response
with selection disabled; a failed/426 request instead uses the distinct load-error
branch. The backend requires `intake-authority-v2` unconditionally on this route,
even for provider-only accounts. This is real installed-artifact behavioral
capability evidence, not raw header capture. No estimate was selected or saved. Founder confirmed Cancel returned normally.
The existing request logger records mounted paths as `/` and does not log headers;
no claim of a uniquely identified header-capture trace is made. Android physical qualification is recorded below; both store distributions are complete.

## Android exact artifact

Android finished at **2026-09-26T00:41:57.579Z**. The downloaded AAB contains
`com.caloriebank.mobile`, only `android.permission.health.READ_NUTRITION` among
Health Connect permissions, and the capability token and recovery handling in its
compiled JS. EAS records version 1.0.0 / versionCode 7 from the same `37b932d`.

- AAB SHA-256: `81a9f49f69cee90abe9fe86df802b948ad4f43e7a2eabd838dcc3ec806a157ad`
- JS bundle SHA-256: `f68b8665da0e8f8afd705a06981cb4f231c9ad558d5ed07977744300b6f379ea`

The exact AAB was uploaded and published to the existing Internal Testing track
`4701187796213670867`, release `6`, named
`1.0.0 (7) - Phase 1B feature qualification`. Console confirms **Available to
internal testers**. Play parsed 7 (1.0.0), API 26+, target SDK 36. The sole warning
was no associated deobfuscation file; no blocking validation error was shown.
No public track, tester expansion, signing change or store declaration edit.
Samsung pre-update ADB inspection found package `com.caloriebank.mobile`,
versionName 1.0.0, versionCode 6, `com.android.vending` installer and
READ_NUTRITION only. This is prior-version evidence, not versionCode 7 qualification.

After founder confirmed the Play update, read-only ADB inspection confirmed installed
`com.caloriebank.mobile`, versionName **1.0.0**, versionCode **7**, min SDK 26,
target SDK 36, installer **com.android.vending**, and only
`android.permission.health.READ_NUTRITION` among requested Health Connect
permissions. Device-reported last update: `2026-09-25 19:53:25`.
Founder confirmed clean startup on installed versionCode 7 and preservation of the
existing burn selection. Founder photo shows Fitbit Connected, Cronometer Connected
with “Updates from Apple Health on iPhone,” and the “Add calories burned source”
sheet stating “All supported sources are connected.” No Health Connect burn option
is offered: disabled-burn UI check PASS. Founder separately confirmed one Cronometer with the correct existing selection
and normal completed History without new warnings. Existing-provider baseline PASS.

On September 26, Chrome treated the custom link as a Google search, so that
attempt supplied no app capability evidence. The first ADB launch opened Today.
After inspecting the route and Android normalization, an explicit warm intent to
`com.caloriebank.mobile/.MainActivity` using `caloriebank:///manual-estimate`
was delivered to the running activity. Founder observed “Your calorie source
changed. Go back and try again.” This confirms the installed versionCode 7
successfully read and parsed the capability-protected endpoint while enrollment
remained disabled, by the same control-flow evidence described for iOS. No raw
request-header capture is claimed. ADB reverified versionCode 7 and
`com.android.vending` immediately before this check. No code change, additional
build, enrollment, source selection or estimate save was performed. Founder confirmed Cancel returned normally: PASS.

## Production hold verification

At **2026-09-26T00:19:33.151Z**, a read-only repeatable-read production transaction
confirmed zero manual authority boundaries, manual selections, manual states,
usual-estimate boundaries and Today overrides. Deployed backend remains
`bad1750ae997f434c878b33b091ca3b678e70b5f`.

At **00:20:03.771Z**, the deployed compiled environment parser confirmed effective
`MANUAL_INTAKE_SELECTION_ENABLED=0` and `AUTH_MODE=clerk`. The raw enrollment
variable is unset; the parsed default is explicitly verified as zero.
No backend deployment, enrollment, provider/accounting mutation, support submission
or Phase 2 work was performed.

At **2026-09-27T02:33:10.669Z**, the final read-only repeatable-read production
transaction reconfirmed backend `bad1750ae997f434c878b33b091ca3b678e70b5f`,
parsed enrollment **0**, Clerk authentication, and **0 in all five categories**:
manual authority boundaries, manual selections, manual states, usual-estimate
boundaries and Today overrides.

## Final pre-enablement artifact gate

| Check | Result |
| --- | --- |
| Node 20 current-source release validation | PASS: 939 tests / 87 files, lint, types, builds |
| Exact private store distribution | PASS: TestFlight Friends & Family build 8; Play Internal Testing versionCode 7 |
| Existing-provider startup, source selection and History on both artifacts | PASS: founder physical checks |
| Real capability-protected read on both installed artifacts | PASS: successful-read/disabled-selection branch; behavioral evidence, not captured headers |
| iPhone Back navigation | PASS |
| iPhone Back visual alignment | **FAIL: chevron still too low** |
| Samsung package/version and Play provenance | PASS: com.caloriebank.mobile, 1.0.0 / 7, com.android.vending |
| Android Health Connect permission and burn boundary | PASS: READ_NUTRITION only; no burn option |
| Cancel from protected read on both artifacts | PASS |
| Final production hold and manual-record counts | PASS: disabled, all five counts zero |

**Overall gate FAILED. It is not safe to enable under the approved release gate.**
The physical iPhone visual defect remains unresolved. Do not infer full Phase 1B
PASS from the provider/capability checks. No additional code changes or builds are
included in this checkpoint. Manual Intake remains disabled; enabling requires a
reviewed, passing checkpoint and separate explicit founder authorization. Fitbit
accounting, the once-only 0.80 policy, finalized History, Opening Bank and ledger
logic were not changed. The Google support case remains unsent. Phase 2 did not begin.

## Replacement correction checkpoint — 2026-09-27

TestFlight 1.0.0 (9), source `a97af1c5aec153ae03800fe6ab349de5168cf0e4`,
is Testing in the existing Friends & Family group and founder-confirmed installed.
Founder physical Back alignment result: **“Still too low or clipped” — FAIL**.
Qualification stopped per the failure policy. No replacement keyboard physical
PASS is claimed; prior build 8/Android 7 passing evidence above remains preserved.
Android replacement 8 compiled but private delivery is incomplete. See
[the correction evidence](phase1b-ios-keyboard-correction.md) for exact identities,
delivery state and outstanding checks. Manual Intake remains disabled; no new
production count verification followed the early stop.

**PHASE 1B CONSOLIDATED FEATURE QUALIFICATION: BLOCKED — iPhone build 9 Back
chevron remains too low or clipped.**


## V3 native correction authorized — physical gate still pending

The founder authorized the measured compression-priority correction and one new
iOS TestFlight artifact. See [V3 correction evidence](phase1b-ios-keyboard-correction.md).
Full Node 20 validation now passes 946 tests / 89 files. This is not a physical
PASS. Resume existing Android versionCode 8 delivery; no new Android build.
First iPhone physical gate remains visible Back alignment, followed by navigation,
tap target and VoiceOver, then the specified shared keyboard checks. Stop if Back
still fails. Prior passing provider/capability/accounting evidence is preserved.
Manual Intake remains disabled; final zero-state verification follows physical QA.
