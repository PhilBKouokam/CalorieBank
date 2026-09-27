# Final consolidated UI correction

Status: BLOCKED — replacement iPhone build 9 still fails physical Back alignment.
Local release validation passed; keyboard physical qualification remains pending. Exactly one replacement per platform has been submitted.
Manual Intake remains disabled. This continues, rather than repeats,
the provider/capability qualifications recorded in
[the consolidated artifact evidence](phase1b-consolidated-feature-qualification.md).
That evidence was committed and pushed first as `2f013d3`.

## Native Back finding

The actual installed dependency is react-native-screens 4.16.0, Fabric enabled.
Inspection of `RNSScreenStackHeaderSubview.mm`, header configuration, the JS header
subview and C++ shadow node confirms that the patch targets the left bar-item
container. Its center-X and center-Y anchors already match upstream; no evidence
justifies a device-specific offset or glyph translation.

Comparison with [upstream #3449](https://github.com/software-mansion/react-native-screens/pull/3449/files)
found an omitted part of the upstream Fabric implementation: the prior patch
stored `_cbBackContentSize` but left `_layoutMetrics` stale. Upstream explicitly
updates `_layoutMetrics`, invalidates intrinsic size only on size change, and
returns that Fabric size from `intrinsicContentSize`. V2 restores that behavior
for iOS 26 left items. Existing wrapper constraints, bounds coordinate conversion,
right-side items, title metrics and older-iOS behavior remain intact. The React
48×48 target, icon, Back accessibility label and navigation handlers are unchanged.

This is an established source-level omission and an upstream-consistent correction,
not a measured explanation of the founder phone's exact view hierarchy. No Xcode
installation is available locally; do not claim a local UIKit compile or simulator
measurement. Cloud compilation and exact TestFlight physical alignment are required.
If it still fails, stop after that one replacement and report this evidence rather
than issuing another speculative binary.

Clean downloaded upstream 4.16.0 header patched with V2 exactly matches the local
V1-to-V2 upgraded header. Repeat application is idempotent. Native source
regressions assert Fabric metric ownership, intrinsic size, both centering anchors,
coordinate conversion, left-only scope and unchanged right items/navigation.

## Keyboard correction and Android impact

The complete inventory, root cause, shared architecture, regression enforcement,
and required physical coverage are in
[keyboard/input safety](../engineering/keyboard-input-safety.md).
Six input-owning files contain eight native inputs, used across onboarding,
Settings, both Step Planning hosts and the dormant manual editor.

The system-wide correction changes Android behavior too: Fitness Goal action taps
now pass through the shared scroll host and the manual editor no longer combines
height avoidance with window resizing. The existing manifest already uses
adjustResize. One Play replacement is therefore required by actual code impact.
The previously passing Android 7 provider/capability evidence remains valid history;
only the changed keyboard primitive and exact replacement provenance need new QA.

The 320px/200% text presentation review found overlapping adjustment-mode labels
in Fitness Goal. Those two controls stack when fontScale exceeds 1.3; ordinary
text layout is unchanged. This is necessary accessible wrapping, not a redesign.
Rendered fixture inspection confirmed scroll reachability of numeric field/help/
Save and wrapped Banking Goal/Daily Bank Target actions. Native keyboard geometry
and dismissal are not simulated by those fixtures.

## Pending closeout

- Final complete Node 20.20.2 release gate PASS: 944 tests / 89 files, full lint,
  type checks, Prisma generation/validation/deploy to the isolated localhost test
  database, API/domain/schema builds and diff check. Log: `/tmp/cb-keyboard-release-final.log`.
  Initial full run exposed three legacy per-screen source assertions and a missing
  Platform mock; tests now follow the shared host. No production database was used.
- Rendered review: Fitness Goal normal 390px/100% and compact 320px/200%;
  Daily Bank Target, Banking Goal, Step Planning and manual editor at 320px/200%.
  Fields/help/results/actions scroll and wrap; exact native keyboard tests remain pending.
- Exactly one iOS replacement and one Android replacement justified above;
  source commit and store artifact identities to be recorded here.
- Exact-artifact founder physical checks mapped in the inventory.
- Final read-only production enrollment/count check. No enablement, backend deploy,
  Fitbit/accounting change, Google support submission or Phase 2 work.

## Replacement submissions

Validated, clean source: `a97af1c5aec153ae03800fe6ab349de5168cf0e4`, pushed with
`[skip render]`. No backend deployment requested.

| Platform | Version | EAS build | Profile |
| --- | --- | --- | --- |
| iOS | 1.0.0 (9) | `561ad270-f732-4862-9a04-3e6f9d434275` | testflight |
| Android | 1.0.0 / versionCode 8 | `9f98fceb-17e1-4d8c-88cf-1769cbf3a27f` | play-testing AAB |

Both jobs identify that same source commit. Exactly one job per platform; no retry
or speculative follow-up. Existing credentials retained. Online Expo dependency
compatibility check passed. Store delivery and physical results will be added
when verified.

iOS build 9 finished at `2026-09-27T03:00:37.815Z`; cloud Node 20.19.4 ran the
postinstall patch and compiled RNSScreenStackHeaderSubview.mm successfully.
Exact IPA metadata confirms com.caloriebank.mobile / 1.0.0 / 9. Native wrapper
symbol and JS capability token are present. IPA SHA-256:
`1d7a6a87c2f14c03614ee41fee0ed07872d768f231d299a0fd02d26e5a02a15c`.
EAS submission `f7bf760a-aa52-425f-aaf5-13e3ec82d68c` uploaded successfully to
Apple. Friends & Family availability and physical QA are not yet confirmed.
Store UI continuation is temporarily blocked by the locked Mac; founder unlock
requested. No additional builds have been created.

At the locked-Mac handoff, Android versionCode 8 remains IN_PROGRESS in EAS.
Resume that existing job; do not create another build.

## Additional Samsung physical evidence

Founder photo shows Fitness Goal with Cut selected and the numeric keyboard open:
the Daily deficit field/value and completion action are below the visible area.
Read-only ADB at follow-up confirms the phone still runs Play-installed
`com.caloriebank.mobile`, versionName 1.0.0, versionCode **7**, installer
`com.android.vending`. This establishes a physical keyboard defect on the prior
artifact; it does not invalidate its passing provider/capability checks or qualify
the replacement. VersionCode 8 must demonstrate visible/reachable focused value,
explanation and Save with the keyboard open, successful save, and normal Android
Back dismissal before Android keyboard safety can pass. No additional build is
created in response to this photo.

## Replacement delivery and physical stop — 2026-09-27

- Existing iOS 1.0.0 (9) completed Apple processing and was assigned to the existing
  Friends & Family group (unchanged two testers). App Store Connect shows **Testing**;
  ASC build ID `2b779679-7559-43d8-819a-51a696d2426c`.
- Founder confirmed build 9 installed through TestFlight. On Settings → Health
  Connections, founder answered **“Still too low or clipped”** when asked whether
  the Back chevron was centered. This is authoritative physical **FAIL**, not a
  rendered-test inference. No new screenshot/native hierarchy was captured.
- Stop policy invoked immediately. Build 9 navigation, VoiceOver/tap-target smoke,
  Fitness Goal 500, representative inputs and platform smoke remain **unqualified**.
  The source-level Fabric omission was real, but correcting it did not resolve the
  observed defect. Exact remaining native root cause is **not established**; native
  hierarchy/layout evidence is required before another correction or build.
- Existing Android EAS job finished successfully at `2026-09-27T03:17:52.717Z`.
  Downloaded versionCode 8 AAB SHA-256:
  `59ffc9668c5c174c5d960395f36ec096062719335ab0ce7ad535ba792fdaa1ea`.
  Compiled consumer Health Connect permission remains READ_NUTRITION only.
  Internal Testing release draft 7 was opened, but file selection was canceled
  after the iPhone failure. No AAB upload/publication completed. Existing Play
  release remains versionCode 7; versionCode 8 installation/provenance and physical
  keyboard qualification remain pending. Resume the same artifact, not another job.
- No new builds, product-code edits, backend deployment, accounting/Fitbit changes,
  goal saves, manual account creation, support submission or public release occurred
  during this delivery/qualification continuation. Prior passing evidence is preserved.
  Manual Intake was not enabled. Latest production verification remains the recorded
  `2026-09-27T02:33:10.669Z` disabled/zero checkpoint; no new final production query
  was performed after this early physical stop.

**PHASE 1B CONSOLIDATED FEATURE QUALIFICATION: BLOCKED — iPhone build 9 Back
chevron remains too low or clipped.** Keyboard corrections are not physically proven.


## Authorized evidence-backed V3 correction — 2026-09-27

The [physical resize trace and diagnosis](../engineering/ios-back-resize-diagnosis.md)
are preserved on the release branch. Founder authorized only the iOS 26 left-header
vertical compression-resistance change: **999**, above the wrapper height equality
at **750**. The existing center anchors, intrinsic Fabric size, right items, older
iOS path, Android, React 48×48 Back control and navigation remain unchanged. No
pixel offsets, transforms or padding are added. The patch upgrades V2 installs
and clean installs idempotently. Diagnostic routes, hooks, profiles and exporters
are not included in the production branch.

Focused native/navigation/keyboard regressions: **13 tests / 4 files PASS**.
Full Node 20.20.2 release gate: **946 tests / 89 files PASS**, lint, type checks,
Prisma validation/migrations on isolated localhost test database and builds.
Initial focused invocation from repository root omitted the API Vitest alias
configuration; rerunning from the correct API workspace passed. It was a test
invocation failure, not evidence of a product navigation failure.
The new constraint regression demonstrates the old 750/750 ambiguity and the
unique 48-point solution with 999/750, centered by the existing anchors. It is a
constraint model plus source contract, not native physical proof.

Exactly one new TestFlight artifact is authorized after validation. Existing
Android 8 AAB hash remains
`59ffc9668c5c174c5d960395f36ec096062719335ab0ce7ad535ba792fdaa1ea`;
no Android rebuild is authorized or needed. Private-store delivery and exact
artifact Back/keyboard physical qualification remain pending. Manual Intake
stays disabled. No accounting/backend/provider change or deployment.

## V3 private delivery — 2026-09-27

Validated source: `98c236db9f577292cab523dffee526a036d5f4bd`. Exactly one
new iOS job: `bf42522f-de3b-469d-83ec-8103705b7d89`, **1.0.0 (10)**,
EAS FINISHED. Cloud logs show the production postinstall patch and compilation
of RNSScreenStackHeaderSubview.mm / RNSScreenStackHeaderConfig.mm, followed by
Archive Succeeded. TestFlight submission `787ed7c4-9770-408b-b778-0dd2fc7f3ad5`
completed successfully; Apple processing/group availability and physical results
remain pending.

Existing Android job `9f98fceb-17e1-4d8c-88cf-1769cbf3a27f`, source
`a97af1c5aec153ae03800fe6ab349de5168cf0e4`, was delivered without rebuilding.
Play Internal Testing reports **1.0.0 (8) — Keyboard correction**, available to
internal testers, released Sep 27. Existing tester scope retained. The only
preview warning concerned a missing deobfuscation file; no release error.
Founder updated through Play; ADB on Samsung SM_A136U confirms package
`com.caloriebank.mobile`, versionName `1.0.0`, versionCode **8**, installer
`com.android.vending`, and sole requested Health Connect permission
`android.permission.health.READ_NUTRITION`. Physical keyboard QA is pending.
No new Android build, public release, backend deployment or Manual Intake
enablement occurred.

## Physical Android 8 keyboard failure — 2026-09-27

Founder confirmed the Google Play update; ADB verified `com.caloriebank.mobile`,
versionName `1.0.0`, versionCode **8**, installer `com.android.vending`.
Original saved Fitness Goal: **Maintain**. Founder selected Cut without saving,
confirmed the deficit field, then was asked to enter **500**, keep the keyboard
open and scroll to field, explanation and Save Fitness Goal. Founder reported:
**“Something remains hidden or clipped.”** Follow-up asked which part remained hidden even after scrolling. Founder
confirmed: **“All of it, it hides the entire input field.”** The focused amount,
context and completion action are not reachable. This is a physical failure,
not a passing shared-primitive result.
The test edit was explicitly not saved. Founder confirmed Android system Back
dismisses the keyboard normally, and the screen Back arrow returns to Settings
without saving. Original saved Maintain goal was not changed. Qualification
stops under the failure
policy. No additional patch/build is authorized by this failure. Manual Intake
remains disabled; earlier passing provider/capability evidence remains preserved.

iOS 10 (`bf42522f-de3b-469d-83ec-8103705b7d89`, source `98c236d`)
finished compilation and its already-started TestFlight submission completed
successfully. EAS confirms upload to App Store Connect; Apple processing and
Friends & Family assignment have not been verified after this failure.
No physical iOS 10 Back or keyboard result is claimed.

**PHASE 1B CONSOLIDATED FEATURE QUALIFICATION: BLOCKED — Android versionCode 8
Fitness Goal keyboard content/action remains hidden or clipped in physical QA.**

## iOS10 delivery / physical Back check — 2026-09-27

Existing build10 is now **Testing** in existing Friends & Family; no new iOS
job created. Founder confirmed TestFlight10 installed, Back **centered without
clipping**, comfortable edge-of-button activation and normal return to Settings.
VoiceOver correctly announces the Back button, and founder confirmed double-tap
activation returns normally to Settings. Back visual/navigation/tap/accessibility
checks PASS on exact TestFlight10. Keyboard qualification remains pending; do not
infer a full gate PASS.

Android shared IME correction is implemented after the measured version8 failure.
No Android build is requested until final release validation passes. Manual Intake
remains disabled; no backend/accounting/provider changes.

### Android IME implementation validation

Final complete Node20.20.2 gate PASS: **960 tests /91files**, clean lint, all
TypeScript checks, local-only Prisma validation/migrations, API/domain/schema
builds and diff check (`/tmp/cb-ime-release-clean.log`). Focused input/presentation/
onboarding suite:94tests/7files. Expo public/introspected configs, online pinned
dependency check, local Android prebuild, Android module autolinking and canonical
document links passed. Generated consumer manifest requests READ_NUTRITION only;
compiled replacement manifest must still be checked after cloud compilation.
No local Android toolchain compilation is claimed.

Earlier validation iterations exposed missing native-module test mocks and
TypeScript harness imports, both corrected. One unchanged goal API test returned
401 rather than404 in an intermediate full run; subsequent complete runs passed
without any API/auth/accounting change. This is preserved as an intermittent test
observation, not an established product regression or a proven race diagnosis.
The final run is clean.

### Android9 build failure; no AAB produced

Single authorized job `b9a467e6-315c-4ec9-990d-1557f79a2db3`, app1.0.0/versionCode9,
source `376502277cdcb9d997ffa264ce3663e872dc2ccc`, failed configuring
`:caloriebank-keyboard-geometry` before Kotlin compilation:
`'android.defaultConfig.versionName' is not defined`. The pinned Expo module
Gradle plugin's MavenPublicationExtension requires this library metadata. No
replacement AAB exists and Play remains version8. No retry has been requested.

Corrected only the local library's Gradle defaultConfig metadata (versionName1.0.0,
library versionCode1; independent of app versionCode). Complete Node20 release
gate rerun PASS:960tests/91files, clean lint/types/builds/diff, log
`/tmp/cb-ime-metadata-release.log`. Native Kotlin compilation remains unverified;
there is no installed local Android Java/SDK toolchain. Another remote job needs
founder authorization because the one-job allowance was consumed.

iPhone10 Fitness Goal: founder confirmed500 input/context/Save reachable with
keyboard open, Save succeeded, and Maintain was restored through normal UI.
No test goal remains saved. Other shared-input checks continue.
