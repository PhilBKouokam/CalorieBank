# Android 8 keyboard root cause — 2026-09-27

**ANDROID KEYBOARD ROOT CAUSE: ESTABLISHED — READY FOR FOUNDER REVIEW BEFORE CORRECTION**

Diagnosis only. No production code, dependency, window configuration or build changed.
Physical evidence comes from existing Google Play versionCode 8, source
`a97af1c5aec153ae03800fe6ab349de5168cf0e4`. Original saved Fitness Goal Maintain
was not saved over. No manual records or account changes were made.

## Artifact and configuration

Samsung SM_A136U, Android **13 / API 33**, 720×1600 physical pixels, density 1.875
(384dp wide), system font scale 1.0. This is not an Android 16 handset: API 36 is
the application's target SDK. ADB confirmed `com.caloriebank.mobile`, 1.0.0,
versionCode 8, installer `com.android.vending`.

Pinned Expo 54.0.37; expo-router 6.0.24; React Native 0.81.5;
react-native-screens 4.16.0; safe-area-context 5.6.2; Fabric/new architecture.
The shared primitive is unchanged between artifact source a97af1c and current HEAD.

Compiled AAB manifest protobuf contains MainActivity `windowSoftInputMode=adjustResize`
(compiled enum 0x10). Local generated manifest agrees, but is corroboration rather
than proof of cloud input. Runtime WindowManager reports `adjust=resize
forwardNavigation`, window flags `81810100`, private flags `16020040`,
`vsysui=1110`, no fitting sides, transparent system bars, display-cutout ALWAYS.
App config and generated Gradle properties enable edge-to-edge. Pinned Expo's
EdgeToEdgePackage invokes RN WindowUtil.enableEdgeToEdge, which calls
`WindowCompat.setDecorFitsSystemWindows(window, false)`.

## Actual hierarchy and ownership

ReactSurfaceView → SafeAreaProvider → root ScreenStack → ScreenContentWrapper →
settings ScreenStack/CoordinatorLayout → native header (height150px) + Screen
→ ScreenContentWrapper → SafeAreaView → **one ReactScrollView** → flattened
React content group → Fitness Goal card/options → deficit label/input/help → Save.

The two navigation stacks are not nested scroll owners. Accessibility emits
additional ScrollView-labelled grouping nodes; the native hierarchy proves only
one actual ReactScrollView owns this form. Input, explanation and Save are inside
its content group. None is fixed/absolute. Settings is a sibling of the tabs group,
so there is **no bottom tab bar** in this screen's runtime hierarchy.

## Closed/open measurements

[Filtered native geometry](evidence/android8-keyboard-geometry.json) contains no
account identifiers, health values, credentials or input contents. All figures
below are physical pixels; accessibility bounds are screen-coordinate snapshots.

| Layer / measurement | Keyboard closed | Numeric keyboard open, settled |
| --- | --- | --- |
| Window / ReactSurfaceView | 0,0–720,1600 | unchanged |
| App configuration bounds | 0,45–720,1510 | unchanged |
| Settings header | 0,0–720,150 | unchanged |
| Screen/SafeAreaView | screen y150; 720×1450 | unchanged |
| ReactScrollView local frame | 0,45–720,1360 | unchanged |
| Native scroll viewport | screen y195–1510, height1315 | unchanged |
| Accessibility clipped scroll bounds | 0,195–720,1465 | unchanged |
| Scroll content | 720×1838 | unchanged |
| IME source | invisible, empty frame | 0,928–720,1600, visible |
| IME bottom inset | 0 | 672 |
| System navigation inset | 90 | 90 |
| Deficit input screen bounds | 77,1117–645,1243 | identical; focused |
| Explanation screen bounds | 77,1257–645,1325 | identical |
| Save button screen bounds | 77,1340–643,1441 | identical |

The app-side InsetsController itself reports the correct visible IME source.
This is not a missing OS keyboard signal or an assumed Samsung keyboard height.
The screenshot independently shows the keyboard beginning at y928 and the whole
editable region behind it. Accessibility bounds are not proof of visibility over
an IME; they report these occluded controls too.

**Scroll arithmetic:** content-local input y1437–1563; help y1577–1645;
Save y1660–1761. The measured content→screen translation is −320px, giving
an effective content scroll displacement of 515px relative to viewport top195.
This is inferred from native and accessibility coordinates, not a directly read
`mScrollY` field. Pinned ReactScrollView.getMaxScrollY computes contentHeight minus
viewportHeight (no outer scroll padding configured): **1838−1315=523px**.
Even at that maximum, input ends at **1235**, help at **1317**, Save at **1433**.
They cannot fit above IME top928. Save needs offset **1028**, 505 beyond the native
range. The additional 45px accessibility clipping cannot improve this bound.
It is recorded separately, not invented as a keyboard offset or primary cause.

## Timing / focus evidence and limits

Closed capture: field unfocused; open capture: same frame, focused, IME visible;
a second settled native capture retained identical root/scroll/content geometry.
Samsung InputMethodManager history records SHOW_SOFT_INPUT for this exact field
(view1006) at **16:38:34.439**, monotonic **89230915ms**, with ADJUST_RESIZE.
Native focus-call timestamp, first inset delivery, JS keyboardDidShow dispatch
and individual scroll-call timestamps are **not exposed by these release dumps**.
No precise sub-frame timeline or native call stack is claimed.

Static pinned RN evidence fills the control-flow boundary: ReactScrollView
requestChildFocus calls scrollToChild, whose calculation uses the unchanged view
rectangle. The child is already within that rectangle, so it does not require
movement according to that geometry. Measured settled displacement does not change.
RN ScrollView keyboardDidShow stores keyboard metrics and invokes an optional
callback; it does not automatically reserve Android IME space. The shared wrapper
provides no such callback, focus handler, inset consumer or content-size response.
Thus this is not an established early-scroll race: the settled usable viewport
and available range are wrong even long after keyboard animation ends.

The app receives IME geometry; actual JS event payload was not captured. RN's
pinned Android path derives keyboard height from IME minus system bars (672−90=582px)
and screenY from visible display frame. Do not confuse that derived event height
with the full OS IME inset or claim its runtime delivery was instrumented.

## Shared primitive failure

KeyboardSafeScrollView sets iOS automatic keyboard insets, platform dismissal mode,
and handled taps. On Android it supplies **no IME avoidance at all**, relying on
window resize. Expo/RN edge-to-edge disables decor fitting; the measured root stays
full-height despite adjustResize. safe-area-context intentionally reads status,
cutout, navigation and caption insets, **not IME**. Consequently the safe-area and
scroll view never shrink or gain keyboard scroll range.

Classification: **A + B + C**, with focus-to-scroll **F** as a consequence of the
wrong visible rectangle. No nested-scroll conflict; no bottom-tab double count;
no evidence that Samsung reports the wrong IME inset. Normal navigation/safe-area
space (90px bottom; 45px top at this host) is not keyboard accommodation.

The previous regression checked wrapper usage, tap/dismiss props and a rendered
500/save interaction. It never measured a real edge-to-edge Android viewport or
proved that receiving an IME inset changes the effective scroll range. Therefore
its passing result could not detect this failure.

## Normal text comparison

Banking Goal name field, no text edited or saved: normal keyboard IME source also
0,928–720,1600. Root720×1600, scroll1315px and content1315px stayed unchanged on
show/hide. Native maximum scroll range is **0**. Name field screen y855–953 is
partly covered; second numeric field y1023–1122 and Save y1259–1360 are behind IME.
This reproduces the same mechanism with a normal text keyboard. Equal observed
IME sizes on this handset do not imply all keyboard types/devices have equal size.

## All eight input surfaces: structural audit, not new physical qualification

| Input(s) | Host category | Scrolling/action ownership | Android exposure |
| --- | --- | --- | --- |
| Fitness Goal deficit/surplus (1) | Long card; settings/onboarding | Shared host; help+Save/Continue inside | Physically measured failure |
| Daily Bank Target (1) | Full-screen numeric form; settings/onboarding | Shared host; presets/help/action inside | Same missing IME owner; not physically retested |
| Banking Goal name/calories (2) | Short card inside PlaceholderScreen | Shared host; both fields/help/Save inside | Normal-text failure measured; zero native range |
| Step Planning burn/steps (2) | Dynamic result cards; two detail hosts | Shared host; fields+live results inside | Same missing IME owner; no Save; not retested |
| ManualEstimateEditor (1) | Standalone estimate form | Direct shared host; Save/Use/Reset/Cancel inside | Structurally exposed; disabled, no production test |
| Delete confirmation (1) | Full-screen normal-text form | Direct shared host; destructive action inside | Structurally exposed; not opened or submitted |

No editable native sheet with a different scrolling architecture was found.
Onboarding reuses the same input owners and shared scrolling. Hosted auth/provider
browser forms and OS dialogs are not app-owned inputs. All eight need the shared
Android correction; degree of visible failure depends on content position/length.

## Minimum proposed correction — NOT IMPLEMENTED

Keep iOS automatic insets unchanged. Give the **Android branch of the single shared
primitive** an actual IME-aware viewport owner. Use measured window-coordinate
keyboard overlap to bound the scroll viewport above the IME, applying only overlap
not already excluded by its parent/safe area; restore the original viewport when
hidden. Example measured overlap here is1510−928=582px, **not a constant to encode**.
After viewport layout, re-evaluate the focused input's visibility using native
measurement; no timer or per-screen scroll workaround. Context/actions remain
reachable by normal scrolling. An inset-driven native adapter is preferable if
reliable window geometry cannot be obtained through the existing RN event/layout
interfaces; no new dependency has been selected or installed during diagnosis.

This directly repairs the established missing-IME-owner mechanism without changing
Fitness Goal, global edge-to-edge policy, tab layout or iOS. Validate both already-
resized and overlay windows to prevent double avoidance. A corrected viewport of
height733 (928−195) would provide1105px of scroll range for the measured long form,
which exceeds the1028px needed for Save. This arithmetic is a proposed contract,
not physical proof of a correction.

Expected implementation files: KeyboardSafeScrollView.tsx (possibly an adjacent
Android-only geometry helper/native adapter if needed), keyboard-safety.test.ts,
keyboard-safety.mobile.test.ts, this evidence and keyboard-input-safety.md.
No screen-specific layout edits are proposed. Android versionCode9 will be needed
after separately authorized implementation and validation. No diagnostic build is
needed to establish this cause. This Android finding does not prove iOS keyboard
behavior passes; iOS10 remains separately physically unqualified.

## Preserved state / stop

App Store Connect now reports iOS **1.0.0 (10), Ready to Submit**, Team(Expo) only;
ASC build `cdc04640-689b-4055-868d-de55f737d960`, EAS
`bf42522f-de3b-469d-83ec-8103705b7d89`. Friends & Family assignment and physical
Back/keyboard testing remain pending. This diagnosis did not change that artifact.
No new build, backend deployment, provider/accounting change, support submission,
Manual Intake enablement or manual record creation. Latest known production zero
counts remain prior evidence; no new production query was needed for this diagnosis.

References: [Android edge-to-edge/inset ownership](https://developer.android.com/develop/ui/views/layout/edge-to-edge-manually),
[Android IME configuration](https://developer.android.com/develop/ui/compose/system/setup-e2e),
[RN0.81 ScrollView: keyboard insets are iOS-only](https://reactnative.dev/docs/0.81/scrollview),
[Expo54 configuration](https://docs.expo.dev/versions/v54.0.0/config/app/).

## Subsequent founder-authorized implementation

The diagnosis and version8 measurements above remain historical evidence. Founder
subsequently authorized the shared Android correction described in
[keyboard safety](keyboard-input-safety.md#authorized-android-ime-correction--implementation-not-physical-pass).
An Android-only native geometry adapter resolves the coordinate-space boundary;
no production screen-specific workaround or iOS keyboard change is included.
Physical correction qualification remains pending.


## Measured correction physically closed — 2026-09-28 UTC

The authorized metadata-corrected retry `fafa500b-fe82-40b5-b3a7-80775d101e94`
compiled source `29753aaf639c06f38d6614df87b3effe023831b8` as Android1.0.0,
versionCode10. Existing Play Internal Testing delivery and ADB installer
`com.android.vending` verification preceded founder QA on the same Samsung.
Fitness Goal500 with keyboard open now permits reaching field, explanation and
Save; save succeeds and Maintain was restored. The zero-scroll-range Banking
Goal class passes both normal text and numeric keyboards. Daily Bank Target and
both Step Planning input/result layouts pass; Android Back, screen navigation,
Today/History/Health Connections and bottom spacing smoke pass. No repeat numeric
frame capture is claimed: these are authoritative founder physical observations.
Prior version8 measured failure remains intact above. See
[final evidence](../deployment/phase1b-consolidated-feature-qualification.md).
