# Final consolidated UI correction

Status: final local release qualification PASS; replacement artifact physical
qualification pending. No replacement build created yet. Manual Intake remains disabled. This continues, rather than repeats,
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
