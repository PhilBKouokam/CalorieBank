# iOS Back resize: physical diagnostic build 2

Status: **IOS BACK ROOT CAUSE: ESTABLISHED — READY FOR PRODUCTION CORRECTION**.
This is a constraint-level diagnosis, not a fixed/qualified production artifact.
No correction is implemented or build authorized by this report.

## Artifact and evidence

- CB Back Geometry 1.0.0 (2), internal ad hoc; EAS
  `11973097-3d93-4b20-a12f-c793c06900f7`.
- Source `33d94d7d82c39cae30630c44aa733f62b211fbea`; physical iOS 26.6.2.
- Founder confirmed the same visibly low chevron as CalorieBank build 9,
  opened the share sheet and supplied schema 2 export.
- Original export SHA-256: `ff415b001abc24fa14aa15ed4ecd9f7f68db027b1e8ebbc3056ea864bbc6b238`.
- [Preserved trace](evidence/ios-back-build2-resize-trace.json) contains all 200
  events, complete native stacks, warnings status and selected final view records.
  No trace events were dropped. Original sample arrays remain in the supplied
  export; the retained subset is explicitly a derived evidence file.
- Build 9 remains a physical failure; the shared keyboard correction remains
  physically unqualified. Previous provider/capability qualifications are preserved.

## Established cause

The custom wrapper leaves two competing vertical preferences at priority **750**:
its equality to the header height, and the header's intrinsic compression
resistance. UIKit supplies a required 36-point outer item height. The header's
48-point intrinsic content is therefore allowed to compress to 36. Both the
initial 48-point and later 36-point layouts report `hasAmbiguousLayout = true`.

Crucially, the earlier apparent “required height = 48” row is an
**NSContentSizeLayoutConstraint**, not an explicit required `heightAnchor = 48`
constraint added by our patch. Its generic exported priority/relation does not
fully represent the two intrinsic-size preferences. The dedicated runtime APIs
report vertical hugging **1000**, compression resistance **750**. Apple's documented
intrinsic-size model is `height <= intrinsic` for hugging and `height >= intrinsic`
for compression resistance. Thus 36 respects required hugging while violating
only the optional compression preference.

At the actual mutation, `constraintsAffectingLayoutForAxis:vertical` changes from
including the intrinsic-size constraint to including our **750 wrapper-height
equality**. The header becomes 36 during the wrapper's native `layoutSubviews`,
through **UIView setBounds: → CALayer setBounds:**. This is the measured native
application of the ambiguous constraint layout, not a Fabric commit of height 36.
The constraint preference change identifies the cause without inventing names
for stripped private UIKit stack frames.

The compact constraint model is:

| Relationship | Priority | Evidence |
|---|---:|---|
| UIKit ItemWrapper height = 36 | 1000 | `NSAutoresizingMaskLayoutConstraint`, owned by `_UINavigationBarPlatterItemView` |
| UIKit ItemWrapper top/bottom = custom wrapper top/bottom | 1000 | Runtime vertical affecting constraints |
| Header centerY = custom wrapper centerY | 1000 | Existing patch and runtime |
| Header height <= 48 (intrinsic hugging) | 1000 | Runtime hugging API + documented intrinsic-size semantics |
| Header height >= 48 (compression resistance) | 750 | Runtime compression API + documented intrinsic-size semantics |
| Custom wrapper height = header height | 750 | Existing patch; becomes an affecting constraint at resize |

The two optional requirements conflict when the wrapper is 36. At height 48 the
wrapper equality yields; at height 36 the compression preference yields. The
trace observes both states without changes to the intrinsic 48×48 size.

Sources: [Apple intrinsic-size and priority semantics](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/AutolayoutPG/AnatomyofaConstraint.html),
[Apple ambiguous layouts](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/AutolayoutPG/AmbiguousLayouts.html).
Apple explicitly describes equal-priority conflicting optional constraints as an
ambiguity and distinguishes it from required-constraint failures.

## Timeline

Times below are milliseconds relative to native window attachment. Negative
values are pre-mount events; trace start precedes mount by 26.432250 ms.
Setter timestamps are observations immediately after the original setter returns,
not instrumented CPU instruction timestamps.

| Time | Observation |
|---:|---|
| −26.431 | Fabric receives 48×48; previous stored size is 0×0 |
| −26.385 | Stored Fabric size is 48×48 before native layout |
| −8.045 | Custom wrapper created |
| −7.876…−7.757 | Initial native left bar item assignment |
| −4.579 | Wrapper fitting returns 48×48 |
| −1.526 | Wrapper bounds become 48×36 |
| −1.465…−1.441 | Header bounds become 48×48, centered at y = −6 inside wrapper |
| −0.414 | Header reports ambiguous layout; intrinsic constraint appears in vertical affecting list |
| 0 | Window attachment |
| +8.203…+8.259 | Another native left bar item assignment |
| +9.130…+9.148 | Old UIKit ItemWrapper edge constraints removed; replacement wrapper gets equivalent constraints |
| +9.315 / +9.378 | Wrapper fitting still returns 48×48 |
| +10.313 | Custom wrapper `layoutSubviews` enters |
| **+10.325250** | **CALayer bounds hook observes header 48→36**, center unchanged at parent y = 18 |
| **+10.513125** | **UIView setBounds hook observes the same resize** |
| +10.686 | Custom wrapper layout exits |
| +10.821 | Header after-super snapshot: 36 high, ambiguous, wrapper-height equality in affecting list |
| +24.937…+24.941 | Fabric receives/stores 48×48 again, now origin (20,4); native height stays 36 |
| +504.094 / +504.436 | Wrapper fitting still returns 48×48 |
| +151,019 approximately | Founder export: same 36/48 mismatch and low glyph |

The second native assignment/replacement precedes the alternative solution. We do
not claim why React Navigation initiated that assignment; it exposes the existing
ambiguity rather than creating a new height constraint in application code.

## Stack and method attribution

The hook records `setBounds:`, not a `setFrame:` transition. The nested layer hook
records the same operation. Immediately outside the UIView bounds hook is:

`UIKitCore 0x1a0f0f49c`, image UUID
`0D94422F-FE7C-302E-B896-3BC5873C0CFC`, image offset **586908**.

Its callers include UIKitCore offsets **298244, 298064, 581004, 460584, 296540**,
then our wrapper layout observation. The complete exact stacks/addresses are in
the evidence JSON. Private UIKit method names are **not symbolicated** in this
export; local matching device symbols are unavailable. Large C++ symbol offsets
reported for app instrumentation are nearest exported symbols, not proof that a
React component-descriptor constructor caused the resize. We do not substitute
those misleading names for the instrumented method identities.

Responsible observed path: custom `UIView` wrapper native layout → UIKit layout
machinery → header `setBounds:` → backing-layer `setBounds:`. Constraint-level
cause is established above; the precise private UIKit helper's name remains unknown.

## Other requested findings

- Fitting: all **14 recorded** fitting calls return **48×48**, including calls
  after compression. No recorded `sizeThatFits:` call returns 36; none were recorded.
  Base-method hooks may miss subclass overrides that do not call super.
- Header and custom wrapper: mask translation **false**, autoresizingMask **0**.
  UIKit ItemWrapper: mask translation **true** and a generated required height-36
  constraint. Thus the 36-point outer metric is supported by an actual UIKit-owned
  constraint, not merely inferred from the number. This does not establish a
  universal 36-point rule for all iOS 26 bar items.
- Constraints: required center and UIKit outer constraints remain satisfied.
  Intrinsic compression at 750 yields to the tied wrapper equality. No broken
  required constraint is demonstrated.
- Warning query: no matching unsatisfiable-constraint logs returned; coverage is
  explicitly not guaranteed. Warnings were not suppressed. Do not report that
  UIKit categorically emitted no warnings. Optional ambiguity need not produce
  required-constraint warning logs.
- Fabric: its native method retains incoming 48×48 metrics and invalidates
  intrinsic size only when size changes. The later origin-only update does not
  reset bounds or invalidate size. The React Pressable remains at Yoga's 48×48;
  native Auto Layout compresses only the header host, producing a 6-point center
  difference. Painted glyph center is 0.167 points above the Pressable center
  from text rounding, leaving the observed **+5.833-point** visual error.
- Final frames reproduce diagnostic build 1: native glass center 81, custom/header
  center 81, Pressable center 87, Text/painted glyph center 86.833. Glyph asymmetry,
  missing Fabric size and a duplicate translation are not the cause.
- Full 48-point physical hit testing and VoiceOver are not newly qualified by
  geometry. Native clipping/ancestor hit testing must be checked after correction.

## Minimum proposed correction — not implemented

Raise **only the iOS 26 left header's vertical compression resistance** above the
wrapper-height equality's 750; use **999 (`UILayoutPriorityRequired - 1`)** to
preserve the intrinsic content while retaining an emergency pressure valve. Keep
the wrapper equality at 750 and existing center anchors. This makes the wrapper's
size preference yield instead of shrinking the Yoga-sized header. Expected layout:
48-point header centered within the native 36-point wrapper, with y = −6 derived
by Auto Layout. Do not encode −6 or any visual translation.

This is an iOS-only native priority correction, not an icon, React spacing,
keyboard, right-control, Android or navigation redesign. Source correction:
`apps/mobile/scripts/patch-ios-back-alignment.cjs`; focused regression:
`apps/api/tests/ios-back-alignment.test.ts`. Canonical correction/qualification
docs would record implementation and later physical results. The generated target
is `react-native-screens/ios/RNSScreenStackHeaderSubview.mm`.

The proposal addresses the measured priority tie; it is not yet a physically
proven fix. A new production TestFlight binary (next expected build 10) and founder
alignment/navigation/accessibility qualification are required after authorization.
No further diagnostic build is needed to explain this constraint-level cause.

## Preserved boundaries and validation

No product code changes in this analysis. No build, upload, backend deployment,
accounting/provider/Fitbit mutation or production access. Android versionCode 8
remains compiled and undistributed. Manual Intake remains disabled; latest known
production enrollment/manual counts remain zero, not freshly queried here.
The existing keyboard correction is unchanged and awaits physical qualification.

Documentation/evidence only: `git diff --check` is the appropriate check; no claim
of rerunning 944 tests. Worktree: `/Users/kouok/Downloads/CalorieBank`, branch
`codex/ios-back-geometry-diagnostic`. Stop for founder review before correction.
