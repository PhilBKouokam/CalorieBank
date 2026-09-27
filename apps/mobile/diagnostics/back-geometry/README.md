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


## Phase 2 resize trace — preparation

Founder installed 1.0.0 (1), confirmed the same visibly low chevron, and exported
schema 1 geometry. Input SHA-256:
`37c3a9aca1f36b22096de3e4f7f2151d1a90f39ddff96720e6c8efcc2ac8e9b7`.
On iOS 26.6.2, header height changes 48 → 36 between mount and first layout
(~11 ms), while the Pressable stays 48. UIKit glass center Y is 81; painted glyph
center Y is 86.833. Glyph paint is centered in Text; incoming/stored Fabric size
remains 48×48. A required 48-height constraint coexists with actual height 36 and
ambiguous layout. This establishes the mismatch, not the responsible setter or
constraint conflict. Build 9's physical failure remains unchanged.

The founder authorizes one replacement INTERNAL diagnostic artifact to identify
the caller. `CBBackTrace.inc` interposes UIView geometry, mask translation,
layout, fitting and constraint APIs plus CALayer bounds/position and navigation
item assignment. It records only the header and registered Back ancestor chain.
All original methods execute once with unchanged arguments and return values;
no layout requests, new constraints, sizing priorities, offsets or fixes are added.
Existing private UIKit classes are not replaced or subclassed. Base-method
interposition can miss subclass fitting overrides that do not call super; this
coverage limitation is explicit in the export. CALayer tracing covers geometry
changes that bypass public UIView setters.

Schema 2 adds bounded events, separate reserved 48→36 header stack captures,
vertical constraints and ancestor owners, intrinsic size, vertical hugging and
compression resistance, ambiguous layout, autoresizing masks, fitting results,
Fabric updates and native assignment/layout events. Trace time starts before
mount and exports a mount-time offset; unlike schema 1, early Fabric events are
not assigned a bogus elapsed-since-mount time. View IDs persist across mount.
Constraint ownership not found in the ancestor chain is reported as unknown.

Current-process OSLogStore export requests only unsatisfiable/broken-constraint
warnings, without suppressing them. Store access errors and an empty query are
reported honestly; an empty result is not proof that UIKit emitted no warnings.
No general console, text field content, account, health or credentials are exported.
The isolated route tree and separate signing identity remain unchanged.

The diagnostic profile alone increments its remote build number. No production
TestFlight build, Android upload, production correction or enablement is part of
this work. Root-cause classification and any proposed production correction must
wait for the replacement artifact's physical reproduction and exported caller trace.


Phase 2 pre-build validation (Node 20.20.2): complete release gate PASS,
944 tests / 89 files, lint, type checks, Prisma validation/migrations on the
isolated localhost `caloriebank_test_phase1b_20260923` database, and builds.
Six diagnostic installation/privacy/forwarding tests PASS. iOS Metro export PASS.
`git diff --check` PASS. An initial run used an older RC test-database name
(rejected by the manual persistence guard); the next attempt used the wrong
local database owner (migration permission denied). Final run uses the existing
local owner and passed. No production database access or permission changes.
No local UIKit compile is claimed: this Mac has Command Line Tools, not Xcode.
Cloud native compilation and founder reproduction/export remain required.


## Phase 2 delivered artifact — 2026-09-27

- Exactly one job/artifact: **CB Back Geometry 1.0.0 (2)**, INTERNAL ad hoc.
- EAS `11973097-3d93-4b20-a12f-c793c06900f7`, FINISHED
  `2026-09-27T20:57:54.880Z`.
- Source `33d94d7d82c39cae30630c44aa733f62b211fbea` (pushed).
- Install: https://expo.dev/accounts/philbk/projects/caloriebank/builds/11973097-3d93-4b20-a12f-c793c06900f7
- IPA SHA-256 `d773c28d986ce8773d867cc8101d28e98dc19ac786521144058383a770a7c12a`.
- IPA confirms `com.caloriebank.mobile.backdiagnostic`, build 2, iOS 17 minimum,
  iphoneos26.0 SDK, exact source SHA and native resize/stack/constraint trace keys.
  Provisioning retains two registered phones; health/push entitlements and Health
  usage descriptions are absent. The JS bundle has no `/v1/me/` route.
- Cloud compiled the instrumented native header and archived successfully.
  Install and post-build source hashes are identical:
  - `RNSScreenStackHeaderSubview.mm`: `e5299eebd51488b13463d17f381508ed5edd7cc0df2e53f1fdeab00761eb786a`
  - `CBBackGeometry.inc`: `18499318d83ad64fc916b52c851546ccba36005e5d2ed768259bf8c813761a0e`
  - `CBBackTrace.inc`: `e64aaeff33676f4c5ada2a54ec5fb4a0ff278d9e9a7222f2a45f2fd8568a88cb`
- Physical reproduction and schema 2 export are pending. No responsible caller,
  broken constraint, fitting result or production correction is claimed yet.
- No CalorieBank build 10, Android upload, backend deployment or production fix.
  Manual Intake remains disabled; no production mutation was performed.
