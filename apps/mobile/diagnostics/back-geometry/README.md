# Isolated native Back geometry diagnostic

This is diagnostic-only source on `codex/ios-back-geometry-diagnostic`, not a
production correction. The failing Back component and alignment patch remain
unchanged from `a97af1c`. No code here belongs in the release branch by default.

Profile `back-geometry-diagnostic` uses the same pinned dependency lockfile,
Fabric, Xcode 26.0 image and Node 20.19.4 as iOS build 9. Distribution is internal
ad hoc, separate bundle `com.caloriebank.mobile.backdiagnostic`. It opens an
isolated Expo Router root with the same nested native-stack/header configuration
and original NavigationBackButton. There is no Clerk, account, API, health,
provider, notification or lifecycle import in that route tree. Diagnostic signing
entitlements omit health and push; no OTA updates are enabled.

Postinstall adds observation hooks to the already-patched 4.16.0 native header.
These hooks do not modify frames, bounds, transforms, constraints or layout.
Installation fails closed if diagnostic native source is encountered outside its
explicit profile. Use a clean dependency installation before any future
production build. Cloud installation logs source/payload SHA-256; the success
hook reports hashes again after compilation to detect later source replacement.

## Capture

The founder opens the isolated Health Connections header, confirms whether the
same visual defect reproduces, then presses Export geometry. The share sheet
exports a local JSON file. The app performs no automatic network upload.

Samples include mount, first layout callbacks, next main queue turn, four display
frames, 0.25/1/2-second settled points, and the explicit export point. Diagnostic
timers only observe; they do not trigger layout or apply offsets. View count,
layer depth and sample count are bounded.

The report includes navigation-bar descendants and its ancestor chain, stable
within-report view IDs, parent-relative frames/bounds/centers and window-converted
bounds/centers; intrinsic sizes, safe areas, layout/alignment insets, constraints,
transforms, clipping, presentation-layer frames, native custom-view identity and
incoming/stored Fabric metrics. UIKit glass/background/button view candidates
include layer geometry. Candidate status is not proof of visual ownership.

Only a one-character Ionicons U+F229 attributed string is inspected. No text
content or accessibility label is serialized. Font metrics are included. Native
view-layer rendering is scanned in memory for nontransparent painted bounds;
no pixel image is exported. Empty/opaque render results are explicitly unavailable,
not fabricated glyph bounds. Reconstructed TextKit baseline is labelled as such;
it is not claimed as the actual RN draw-time baseline. Window-space painted bounds
are the stronger glyph position evidence when available.

If the defect does not reproduce, the isolated artifact cannot establish the
production cause. If UIKit background ownership or glyph rendering remains
ambiguous, report that missing evidence; do not infer a correction from an
unverified candidate or unavailable paint bounds.

No production correction, TestFlight submission, Android delivery, Manual Intake
enablement, backend/accounting/provider change is authorized by this diagnostic.

## Validation

`node --test apps/mobile/diagnostics/back-geometry/install.test.cjs` exercises
production rejection, idempotency, unchanged correction methods, export privacy,
required coordinates and route isolation. The complete Node 20 release gate and
iOS Metro export are also run before the single remote artifact. Native compilation
and founder runtime evidence remain distinct requirements.

## Setup failure, not physical evidence

Initial job `6f092511-a791-4b5f-85db-4ad834da9d56`, source `df52d4d`,
failed during CocoaPods post-install before compilation and produced no artifact.
The isolated configuration omitted Clerk's config plugin, which had supplied
build 9's iOS 17.0 deployment target. Its native pod still registered its Swift
package while the lower default target excluded the pod, producing a nil target
in RN's SPM integration. The diagnostic plugin now explicitly restores 17.0 in
both Podfile properties and Xcode configurations. Local prebuild verifies both.
No Back correction or dependency version changed. A retry is for the same single
diagnostic artifact, not a second installable variant.

## Delivered diagnostic artifact — 2026-09-27

- EAS `8aadc7de-0223-4971-91bb-ee84b7b2de5a`: FINISHED at
  `2026-09-27T20:03:48.325Z`, INTERNAL ad hoc, version 1.0.0 (1).
- Exact source: `8b2f6fe34b9dfff8b6729404f6275b7a955ba448`.
- Install: https://expo.dev/accounts/philbk/projects/caloriebank/builds/8aadc7de-0223-4971-91bb-ee84b7b2de5a
- IPA SHA-256: `80d5e307f9b137d35fcf2beee8ebaab18f2988de2f4ffd848c7864ab117214f0`.
- IPA confirms separate bundle, name CB Back Geometry, iOS 17.0 minimum,
  iphoneos26.0 SDK, native exporter/paint measurement strings and exact source SHA.
  Embedded provisioning allows the two previously registered iPhones and has no
  HealthKit or push entitlement. No Health usage descriptions. JS contains the
  diagnostic UI, no production API URL and no `/v1/me/` route string.
- Cloud compiled RNSScreenStackHeaderSubview.mm and archived successfully.
  Install and post-build hashes match exactly:
  native source `a5f03641f526f1b1d193b3e66b3946de57531a1b4bddcef4d929df93f59fc75d`;
  instrumentation `1d70876bbc0d668e647b0a6b25df9287e1181e2478bcd06140eadd41281951c4`.
- Validation: final complete Node 20 gate passed 944 tests / 89 files, lint,
  type checks, local database checks and builds; five diagnostic tests passed;
  local iOS Metro export and prebuild passed. No local Xcode compilation claimed.
- Two jobs were attempted: first setup failure above, then this successful job.
  Exactly one installable diagnostic artifact was produced. No production build
  10, TestFlight submission, Android upload, backend deployment or enablement.
- Founder installation confirmation, reproduction and exported runtime geometry
  are pending. No root cause or physical success is claimed.
