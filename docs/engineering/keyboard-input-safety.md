# Keyboard and input safety

Status: Android 8 physically failed; Android IME ownership root cause established.
The resize-only Android architecture below is historical implementation evidence,
not an effective keyboard-safety guarantee. No further correction is implemented.
The passing Phase 1B provider/capability checks on iOS 8 / Android 7 from `37b932d`
remain preserved. Manual Intake stays disabled. This document grants no enablement.

## Permanent invariant

With the keyboard open, the focused field, its explanation/result and the primary
completion action must remain reachable by scrolling. Dismissing the keyboard
must not be a prerequisite discovered by trial and error. Closed-keyboard styling,
safe areas, navigation and the locked Step Planning hierarchy remain unchanged.

## Root cause and architecture

Fitness Goal used an outer KeyboardAvoidingView with default zero header offset
around PlaceholderScreen's ordinary ScrollView. The latter opted out of keyboard
insets and used default tap dismissal. It did not share the keyboard-aware path
used by Banking Goal. Avoidance calculated in a header-offset screen is not the
same as the native scroll view calculating keyboard overlap in window coordinates.
Earlier keyboard fixes addressed individual screens rather than all input hosts;
there was no enforced route-to-input inventory. The reported physical failure is
authoritative; no measured device view hierarchy is claimed.

`KeyboardSafeScrollView` is now the sole owner for native editable content:

- iOS: React Native 0.81 native automatic keyboard insets and first-responder
  scrolling. The pinned Fabric implementation converts the scroll origin to window
  coordinates and computes overlap with the keyboard end frame. Interactive drag
  dismissal remains available. No header/device offset or timed focus callback.
- Android: existing adjustResize window behavior, bounded scroll content and
  on-drag dismissal. No second KeyboardAvoidingView shrinking an already resized
  window. Android Back retains its native keyboard-dismiss behavior.
- Both: `keyboardShouldPersistTaps="handled"` allows a visible Save/Continue
  button to work while the keyboard is open. Field, help, results, error and action
  remain in the same scroll content. Existing SafeAreaView and styles are retained.

This does change Android code: Fitness Goal previously used the plain host with
tap dismissal; ManualEstimateEditor had an additional height-avoidance layer.
Therefore one Android replacement is needed under the founder's conditional
authorization, not for platform symmetry. Its provider baseline does not need to
be reopened. The changed keyboard primitive needs exact Play-artifact physical QA.

References: [RN 0.81 ScrollView](https://reactnative.dev/docs/0.81/scrollview),
[KeyboardAvoidingView](https://reactnative.dev/docs/0.81/keyboardavoidingview),
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).

## Complete app-owned input inventory

Code search covers all `apps/mobile/app` and `apps/mobile/components` TSX files,
not the archived SDK backup. Six input-owning files contain eight TextInputs.
Routes and conditional reuse are included even when currently hidden by enrollment.

| Input owner | Reachable host(s) | Entry / action | Previous implementation | Current primitive |
| --- | --- | --- | --- | --- |
| GoalConfigurationForm | Settings Fitness Goal; onboarding Fitness Goal | Numeric deficit/surplus; Save / Continue | Outer avoidance; Settings plain PlaceholderScreen | Shared scroll via keyboard-aware PlaceholderScreen / onboarding shared scroll |
| DailyBankTargetInput | Settings Daily Bank Target; onboarding DailyBankTargetForm | Numeric target plus presets; Save / Continue | Settings automatic insets; onboarding outer avoidance | Shared scroll |
| planned-treat | Settings Banking Goal | Text name and numeric calories; Save plan | Keyboard-aware PlaceholderScreen plus 250ms focus-scroll workaround | Shared scroll via PlaceholderScreen; timer removed |
| StepPlanningCards | Steps detail; Today burn detail | Two numeric targets; live results | Separate automatic-inset scroll hosts | Shared scroll; card hierarchy and select-all-on-focus unchanged |
| ManualEstimateEditor | manual-estimate route, select/usual/Today modes | Numeric estimate; Use estimate / Save / Reset / Cancel | Separate avoidance + scroll | Shared scroll; dormant enrollment remains off |
| delete-account | Settings Delete account | Normal keyboard confirmation text; destructive action | Separate automatic-inset scroll | Shared scroll; physical QA must NOT submit deletion |

Source choosers, native-food, provider help, date/source override sheets, settings
toggles and goal presets are selection controls, not text-entry surfaces. They
have no additional TextInputs. Health Connections opens the separate manual route;
it does not embed an editable modal. Sign-in/create-account and Fitbit/FatSecret
authorization use external hosted browser forms; the app owns no credential fields
or embedded WebView input layout. System permission dialogs are OS-owned. Do not
count externally hosted/system input as a native primitive that this patch changed.

## Regression and physical coverage

`keyboard-safety.test.ts` inventories all input owners/counts, traverses local
component imports from every route, and fails when an input is reachable outside
the shared scroll host. It covers onboarding's composed stage content and rejects
competing avoidance or manual timed keyboard-scroll calls. Update this inventory
and physical coverage when adding an input route or primitive.

`keyboard-safety.mobile.test.ts` mounts the actual Fitness Goal form under the
shared host on each platform, verifies native keyboard policies and tests entering
500 and saving. Existing manual form behavior, native Back and navigation tests
remain required. These tests do not emulate UIKit or Android IME geometry.

Required replacement iPhone checks, founder-operated one action at a time:

1. Back chevron centered in native background; navigation and VoiceOver Back smoke.
2. Fitness Goal: focus daily deficit, enter 500, scroll with numeric keyboard open
   to explanatory content and Save, save successfully, return and verify dismissal.
3. Daily Bank Target: edit numeric value, reach result/help/action, dismiss normally.
4. Banking Goal: normal text and numeric fields, focus transfer, scroll to action.
5. Step Planning: both compact inputs, select-all, live results reachable, blur.
6. Small viewport / 200% text representative long form and Step Planning; preserve
   bottom safe area and return to normal bottom navigation. Restore text settings.

Those hosts qualify the single shared primitive used by onboarding, manual modes
and deletion; per-form rendered/inventory checks establish the reuse. Do not enable
manual enrollment, restart onboarding or delete an account to manufacture coverage.
Record untested state-specific behavior honestly. Android replacement needs numeric
and normal keyboards, focus transfer, action reachability, Back dismissal, small
screen/larger-text and safe-area checks on that exact Play version.

## Physical qualification status — 2026-09-27

The replacement iPhone build 9 failed the first, native Back visual check, and
qualification stopped under the founder's explicit failure policy. Therefore
Fitness Goal 500, Daily Bank Target, Banking Goal, Step Planning and representative
settings/shared-host keyboard behavior remain physically unqualified on both
replacement binaries. Automated inventory and rendered 320px/200% and 390px
evidence are preserved; none constitutes a native keyboard PASS. Android 8 has
compiled but is not yet Play-distributed. Manual forms remain rendered/component
evidence only while enrollment is disabled. See
[correction checkpoint](../deployment/phase1b-ios-keyboard-correction.md).

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

## Android runtime diagnosis — 2026-09-27

See [measured root cause and all-eight structural audit](android-keyboard-resize-diagnosis.md).
On Play8, the app receives the672px IME inset but edge-to-edge leaves root720×1600
and scroll height1315 unchanged. Fitness Goal content1838 yields max scroll523;
Save requires1028 to clear keyboard top928. Banking Goal normal text reproduces
the same mechanism, with zero native scroll range. Safe-area-context excludes
IME by design. The shared Android primitive must own measured keyboard overlap;
`adjustResize` alone is not a release invariant. No per-screen workaround or
correction was implemented. Both unsaved diagnostic flows exited normally.

## Authorized Android IME correction — implementation, not physical PASS

`KeyboardSafeScrollView` now dispatches Android to `AndroidKeyboardSafeScrollView`.
The iOS branch retains its automatic inset/interactive-dismiss behavior. No input
owner, card, formula or screen layout was edited. All eight inventoried inputs
retain the same shared owner.

The Android-only local Expo module `caloriebank-keyboard-geometry` reads native
WindowInsetsCompat IME visibility/insets and `getLocationOnScreen` bounds for the
host, scroll viewport and focused EditText. It uses current window metrics on
API30+ and the visible display frame on supported older Android. Measurements
are converted together to density-independent units; Fabric's visible-frame
origin is never mixed with absolute screen Y. It never reads text, sends data
externally, requests health permission, changes window flags or replaces another
view's inset listener. Global layout/focus observers are removed on unmount.

The stable outer host computes overlap = max(0, hostBottom − max(hostTop, IMETop)).
Only the inner scroll viewport loses that overlap. Parents already resized or
excluding keyboard space yield zero overlap; safe-area/header exclusions are
already represented in the measured host frame. Hide restores zero extra space.
After the new viewport lays out, focused-field bounds are remeasured and native
scroll position supplies the minimal reveal delta. Content-size and native
IME/focus changes also reassess geometry; stale async responses are rejected.
No timed focus callback, screen spacer, fixed keyboard height or device offset.
Android scrolling now keeps the keyboard open (`keyboardDismissMode=none`);
Android Back/IME dismissal remains native, handled taps preserve Save behavior.

Deterministic regressions encode the actual Samsung long-form shortfall, the
short Banking Goal with no closed-state scrolling, density/window-coordinate
translation, already/partially resized parents, different keyboard boundaries,
large fields, show/layout/focus ordering, hide restoration and stale responses.
The inventory continues to enforce shared ownership for onboarding, manual and
deletion forms. These are not physical evidence: Android9 qualification is pending.


## Physical invariant qualified — 2026-09-28 UTC

Exact TestFlight iOS1.0.0(10) and Play Android1.0.0/versionCode10 now physically
pass Fitness Goal500 keyboard-open field/context/Save reachability and save, with
Maintain restored. Daily Bank Target, Banking Goal text/numeric, and both Step
Planning inputs/results also pass on both phones. Select-all, native dismissal,
navigation, safe-area/bottom navigation and absence of residual keyboard space
were confirmed. Android device: Samsung SM_A136U, Android13/API33.

The six enabled input types have real physical evidence. The two remaining
inputs (manual estimate and deletion confirmation) retain shared-owner inventory
and rendered coverage; no manual enrollment or destructive deletion was performed.
Onboarding reuses the qualified goal/target owners and retains composed-route
regressions. 320/390/393px and200% evidence remains rendered, not a newly performed
physical enlarged-text test. Full results and artifact identities are in
[final qualification](../deployment/phase1b-consolidated-feature-qualification.md).

Permanent release invariant: **when an input keyboard is open, the focused field,
information/result needed to understand the interaction, and primary completion
action must remain reachable.** Future inputs must use this qualified shared
primitive or explicitly prove an equivalent keyboard-safe layout. No one-off
screen offsets. Changes to the primitive require fresh real-device qualification.

## October 13 follow-up input inventory

`IntakeAdjustmentEditor` adds one numeric TextInput, reached from Today’s Eaten
pencil via `(settings)/edit-calories`. The editor directly owns one shared
`KeyboardSafeScrollView`; choices, field, result, error, Save, Remove adjustment,
and Cancel are inside it. Select-all-on-focus and number-pad are preserved.
The custom outline is on a wrapper View, with a transparent native underline.
The inventory regression now covers seven input-owning files and nine inputs.
RN Web narrow previews are not proof of physical iOS/Android keyboard geometry;
verify both modes, scrolling to Save with the keyboard open, and the Android
underline on the next authorized test build.

## Runtime system text-size changes — build 13 follow-up

Physical build 13 evidence: Samsung and iPhone clipped already-mounted Today
text after increasing system text size. Fully closing and reopening the app at
that same size repaired both phones. This qualifies cold-start layout only;
it does not qualify live font-size transitions.

`ScaleAwareText` now reads a shared `FontScaleProvider` driven by React Native's
`useWindowDimensions`. A scale change remounts only native text paragraphs so
native measurement is rebuilt with the current scale. The standard bottom tab
bar is similarly refreshed, outside the navigator's state boundary. All 32
app-owned text consumers use this wrapper. Existing styles, native font scaling,
accessibility props, copy, and Step Planning hierarchy are retained.

Do not key the app, navigator, route, scroll container, or TextInput by font scale:
that would discard navigation, drafts, selection or focus. Text wrappers are for
presentation only; do not nest stateful controls or input fields inside them.
No keyboard primitive or input inventory changed in this patch.

Rendered regressions cover larger-to-normal transitions, nested text and
accessibility props, unchanged-size width updates, mounted input/scroll identity,
unsaved Add/Replace/usual-estimate drafts, and selected tab preservation. These
are React lifecycle checks, not native measurement or physical keyboard proof.
No native simulator is available in this workspace (`xcrun simctl` unavailable).
The next combined build must physically qualify on both phones: change text size
while Today is mounted; return without restarting; check card and tab text; then
repeat with an unsaved calorie edit and verify the same screen, value, result and
reachable Save. Change back to normal and cancel the test draft.

## October 15 Android recreation and shared draft correction

The canonical inventory remains **nine TextInputs across seven input-owning files**.
Eight non-destructive inputs use the shared memory-only draft mechanism (including
both Step Planning inputs); account deletion confirmation is deliberately excluded.
Daily Bank Target's settings/setup hosts share the same input component and store.

See [Android font scale and session drafts](android-font-scale-draft-restoration.md)
for the native feature flag, root-recreation tests, revision/account safeguards and
Save/Cancel/Back cleanup. `KeyboardSafeScrollView` remains the only keyboard owner;
this patch adds no offsets, padding workarounds, font limits or Activity suppression.
Physical Android 200% geometry and keyboard qualification of the corrected binary
remain pending. The prior iPhone build-15 physical pass is not proof for this shared
JavaScript change.

## October 16 — Android observer registration race

Physical production-hierarchy diagnostic `9449639` reproduced build 16's exact
582px obstruction in comparisons C (immediate editor data) and D (immediate
session readiness). Native `watch` ran before Fabric could resolve the view,
returned without an observer, and JS treated the void completion as registration.
Later IME changes therefore generated no current-screen geometry measurement.
A/B happened to register successfully; adding a loading delay is not a fix.

The correction leaves `keyboardOverlap` and `focusedScrollTarget` unchanged.
`KeyboardObserverRegistry` owns the target View, Activity, actual window
ViewTreeObserver, attach listener and a screen-lifetime token. Registration returns
`attached`, `pending` with a reason, or `error` with a reason. RN 0.81.5's specific
missing-tag `IllegalViewOperationException` is temporary; unexpected resolver
errors are logged and stop that registration rather than being called success.

Recovery is event-driven, without timers or busy polling: a pending registration
listens to the current Activity decor's global layout, and a resolved detached
view also has an attachment listener. The decor listener lasts only for the
registration lifetime, allowing replacement-view discovery. No event means no
retry work. JS layout and foreground events can reattempt an idempotent watch,
including an initially unavailable Activity. Successful attachment immediately
emits geometry so an already-visible keyboard is measured.

Ownership checks reject detached/wrong-window targets. Cleanup removes both the
stored observer and current observer listeners (Android can merge a floating
observer into a window observer), plus recovery and attachment listeners.
Activity destruction clears destroyed-Activity registrations; module destruction
clears all. An old lifetime cannot unwatch or measure a replacement lifetime.
JS measurements additionally retain request-revision and mounted-lifetime checks.
No account identity, input text or health data enters this native contract.

Regressions cover pending resolution, attachment, replacement, duplicates,
navigation cleanup, Activity replacement, explicit errors, initial measurement,
layout-before-effect, stale responses and the unchanged 582px/310.4dp geometry.
Native tests use Robolectric against Android API 33; these are lifecycle tests,
not physical proof. Android-only registration code does not alter the iOS owner,
shared draft store, route inventory, safe areas or consumer content.

Release hold: corrected production binary remains unqualified until physical
keyboard-open Save reachability, 200% layout and draft restoration pass on its
exact installed artifact. A passing isolated diagnostic is not production proof.

Automated validation for this correction: Node 20 release gate passed with 1,115
Vitest tests across 107 files, including the iOS keyboard and shared draft suites.
The initial-measurement regression was also run against the original component
and failed as expected. Eight Robolectric lifecycle tests passed during isolated
EAS build `3821ac3b-bd81-421b-b3d8-e4319a4bf255`; the corrected native module and
native test sources compiled. Physical results follow separately below.


### Corrected isolated diagnostic physical qualification — October 16

Artifact `3821ac3b-bd81-421b-b3d8-e4319a4bf255`, diagnostic source
`99ed21ad4ab2c1cb7964e09f47b5241ced8f54d4`, package
`com.caloriebank.layoutdiagnostic` versionCode 2, Samsung SM-A136U / Android 13.
Production CalorieBank versionCode 16 was not replaced.

- A: normal to 200% font size recreated Activity (182736507 to 241923238)
  and surface (1 to 11); the JS runtime survived. Founder confirmed unsaved
  150 survived, no clipping, and input/calculation/Save reachable with keyboard.
  Pending registration for tag 770 recovered to attached on the new view.
- C (immediate editor data): missing-view pending registration recovered for
  tag 1258. Founder confirmed Save reachable at 200% with keyboard open.
- D (immediate session readiness): tag 1552 attached successfully; Save reachable.
- In A/C/D, applied overlap was 310.4dp at density 1.875 = 582 physical pixels.
  Scroll viewport changed from Y195–1510 to Y195–928, exactly keyboard top Y928.
- Cancel after A discarded unsaved 150: subsequent editor showed saved 100.
  Founder tapped Save once for 150 in D with keyboard open and reopening showed
  saved 150. Physical evidence confirms the result; exactly-once semantics are
  additionally covered by automated tests, not inferred from the displayed value.
- Reopening after Save reproduced pending view lookup (tag 1684). Registration
  remained pending while idle, then the keyboard layout event recovered it,
  emitted initial geometry immediately, and applied the same 582px reduction.
  Save remained reachable. This is event-driven recovery, not guaranteed immediate
  attachment when no layout/attach event is delivered.
- No callbacks after disposed-owner cleanup appeared in the captured A/C/D trace.
  Request 4 after reopening was superseded by request 5; only current revision
  drove the subsequent calculation. B was not repeated for this correction.

Geometry-only captures are retained outside Git under `/tmp/cb-recovery-*-physical.log`.
The production replacement artifact still requires its own physical qualification;
this isolated result does not qualify installed CalorieBank build 16. No backend,
production migrations, provider permissions or accounting data were changed.

## Android custom-border input underline invariant — October 16

Every currently reachable app-owned TextInput uses a custom border, either on the
input or its surrounding frame. Each must explicitly set
`underlineColorAndroid="transparent"`, matching the existing calorie-correction
and manual-estimate implementation. Keep the native component and existing props;
a wrapper/refactor is unnecessary for this presentation-only setting.

Audited inventory: Fitness Goal (1), Daily Bank Target (1), Banking Goal name and
calories (2), Step Planning burn and steps (2), calorie correction (1), manual
estimate (1, shared by usual estimate and today's manual intake), and deletion
confirmation (1): nine inputs across seven files. Seven omissions in five files
were corrected; correction/manual-estimate were already compliant. Deletion
confirmation remains excluded from draft restoration. The input-inventory AST
regression checks all nine inputs, including future inventory changes. No style,
validation, keyboard ownership, selection, draft, Save/Cancel or accounting code
changes accompany this setting.

Build 17 physically passed keyboard reachability on calorie correction, Fitness
Goal and Daily Bank Target. Its Daily Bank Target screenshot exposed the native
underline, prompting this batch. Corrected appearance is not physically verified
until a consolidated replacement artifact is approved and installed. Banking Goal
and Step Planning representative keyboard checks, post-test accounting verification
and outstanding Phase 2A forecasting qualification remain separate release checks.
No underline-only build is authorized or created.
