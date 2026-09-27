# Keyboard and input safety

Status: correction implemented; replacement artifact physical qualification pending.
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
