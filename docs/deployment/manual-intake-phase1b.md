# Phase 1B implementation and private rollout

Status: implementation committed and dormant backend deployed. iOS build 5 is Testing privately; Android build 4 is available in Internal Testing.
Manual Intake selection remains disabled. No physical
Phase 1B qualification is claimed.

## Protocol and route inventory

New clients send `X-CalorieBank-Capabilities: intake-authority-v2` on the central
authenticated API transport. Exact comma-separated tokens are parsed per request.
Unknown well-formed tokens do not grant support; malformed/oversized headers fail
closed. This is protocol negotiation, **not authentication or authorization**.
Clerk ownership remains mandatory. No account-level capability is persisted.

Unsupported source-bearing responses return HTTP 426 with
`error.details.code = UPDATE_REQUIRED` and “Update CalorieBank to continue with
this account.” The server must reject before serialization or conflicting writes.
The new client distinguishes this from authentication/network/provider failures.
Phase 1A builds iOS 4 / Android 3 have forward-compatible parsers but emit no
capability. They are unsupported for manual-account protocol access. Their binary
UX cannot be retroactively changed; no automatic authority replacement is allowed.

Audit inventory (completion requires route-level tests, not this list alone):

| Surface | Required protection |
| --- | --- |
| Provider selection / Health Connections | Current authority read guard; account-locked write guard |
| Today | Date-resolved authority guard; atomic normalized value/provenance |
| History/detail/source options | Entire response guard, including manual snapshots after return to a provider |
| Historical source mutation | Reject manual-day historical corrections; capability before mutation |
| Onboarding/preparation | Source-bearing response guard and manual-aware preparation |
| Manual estimate read/write | Capability mandatory, verified account, canonical date, revision and account lock |
| Native nutrition upload | Account-locked current-authority guard; exact writer/revision checks retained |
| Apple Health ingestion | Stores exact writer evidence only; cannot change authority; dated accounting prevents manual replacement |
| Foreground lifecycle/timezone | Account-locked capability check before a manual account’s canonical timezone changes |
| FatSecret OAuth/disconnect | Connection changes do not select authority; explicit selection remains guarded |
| Lifecycle/provider refresh | Internal execution independent of mobile capability; HTTP responses guarded |
| Account deletion, notification settings, harmless preferences | Remain accessible when source-independent |

The response firewall supplements operation-level validation. It is not sufficient
to reject a write only after it has changed state. New source-bearing fields must
be covered by the route contract and tests.

## Rollout and rollback

`MANUAL_INTAKE_SELECTION_ENABLED` defaults to `0`. It gates new manual enrollment,
not server understanding, reads, edits or finalization of existing manual records.
Only after full local validation: commit/push, deploy the exact commit through
Render migration/predeploy, verify provider-only old clients, then build one
consolidated artifact per platform. Qualify existing-provider behavior on those
actual private artifacts before enabling new manual selection.

Enablement requires the complete pre-enablement checkpoint, then real manual
account read/write capability stripping, invariance and physical qualification.
No public App Store, Play Production, Open Testing or public tester link.

Once manual records exist, rollback may stop **new** selections while preserving
existing manual service, capability protection, accounting and history. Do not
roll back to code that cannot understand manual records, relabel them, delete them
or destructively reverse the schema. Fix forward above that backend floor.

## Evidence so far

- Dedicated localhost database: `caloriebank_test_phase1b_20260923`.
- Additive migration `20260923000000_manual_intake` first validated locally;
  subsequent normal production deployment is recorded below.
- Initial protocol tests: 15 passing controlled HTTP tests.
- Initial persistence: usual history, override/reset, zero, retries, conflicts,
  enrollment hold, account isolation and cascade deletion pass.
- Initial accounting test: 2,900 override with 3,400 adjusted maintenance burn
  posts +500 once under concurrent calls; tomorrow returns to the usual value.
- Existing ADR 029 authority suite, including Cronometer 2,716 → 3,149, passes.
- Local release gate and database/route coverage completed below. Deployment and
  build progress are recorded below; physical qualification remains pending.

No implementation or physical completion verdict is implied by these focused tests.

### Local validation checkpoint, September 23

The first full `release:friends-family` run passed **897 tests / 80 files**,
TypeScript, lint, Prisma generate/validate/deploy, API/domain/schema builds and
`git diff --check`. Further safety and UI review changes after that run require a
final gate rerun before committing/deploying; this is not the final release commit.

Expanded persistence evidence includes all three Fitness Goal modes, manual ↔
Apple Health / exact Health Connect package / FatSecret transitions, no summation,
usual/override history, concurrent edit/finalization and migration against populated
Opening Bank/History/Recovery/ledger fixtures. The migration test executes the actual
additive DDL in an isolated schema of the dedicated test database and compares
persisted and consumer accounting before/after. No production test migration.

Actual editor/source-choice components were bundled into isolated React Native Web
fixtures with mocked API/router/platform boundaries, without a production API.
Inspected 320/390 CSS pixels and simulated 200% text: wrapping, reachable actions,
no horizontal overflow, visible selection/source copy, input select-on-focus and
Save interaction. This is component-level rendered evidence, not native keyboard,
VoiceOver/TalkBack or distributed-binary qualification. Full changed-screen and
physical checks remain pending.

Founder approved the exact privacy addition in
[the proposal](manual-intake-privacy-proposal.md). Repository HTML/Markdown updated;
public publication and byte-for-byte verification completed September 23 in Vercel
deployment `dpl_6mEwxhXcBo8FQDxehwP5Uqxb6vwX`. Store declarations have not been changed.

### Final local validation checkpoint

`release:friends-family`: **902 tests / 80 files**, TypeScript, lint, Prisma
(generate, validate, 35 local migrations), schema/domain/API builds and diff check.
Manual persistence has 25 cases, including both source-switch/finalization race
directions. A separate workspace rerun exposed a fixture-only foreign-key DDL
deadlock; migration fixture users are now isolated from concurrent suites. The
complete gate was rerun after that fix. No application accounting change was needed.

Online Expo dependency validation and autolinking verification passed. Both iOS
and Android Hermes exports passed. Isolated Android prebuild passed: package
`com.caloriebank.mobile`, minSdk 26, READ_NUTRITION is the only positive Health
Connect permission; the six diagnostic burn/activity reads are explicitly removed.
The final compiled AAB manifest inspection is recorded below.

At 200% text, Home's two calorie values now stack to preserve readable numbers;
normal-size layout remains unchanged. Actual Home metrics JSX/styles were inspected
in the isolated rendered fixture at 320px. This is not physical device evidence.

### Production predeployment baseline

Read-only repeatable-read transaction, 2026-09-23T19:42:15Z. Existing Render commit
`4c55480602866d86e9187968bedb69632b458ddb`; manual enrollment false. Ten accounts'
current sources: six Apple Health, one FatSecret, three Health Connect. No manual
selection. Hashes contain sorted serialized persisted rows, without publishing raw
health values or account identifiers:

| Model | Rows | SHA-256 |
| --- | ---: | --- |
| providerSelection | 10 | 4ac0ec37d40ef1a48d174a1a85f925b4cad5fc631d20acb93e6978375a619869 |
| bankAccountInitialization | 10 | 95e51c20e29c52abf36dca2cb9386d4a4563908f82458218670a357e56f5ce17 |
| openingBankCalculationDay | 36 | 7213a965ae93705cf4da3fac89c94ab8f00bb7c43311c5020624009fd3f4a836 |
| finalizedDailyBankRecord | 56 | 83d5a0a73e9f55984d74d5dad8dc3544ee21b071c5259d166834d5a1f70582de |
| bankCalculationSnapshot | 59 | 889ff64d8f59c52a51bde88870344e389ec021bef08879bf773eb9d791c2bbf4 |
| calorieLedgerTransaction | 59 | 3528c747fd9038324e23ea043cf0aff4049a20922939e8d71ce3ad9b0acfbec8 |
| intakeAuthorityBoundary | 12 | 41e483977d332a9e8ca8abcd57bfd3b154fe14928a343c74044d2d2c7a21c954 |

### Dormant deployment and build submission, September 23

Implementation: `9435eafb8af8edb5a441403b3832b61cd7ca1560`, pushed on
`codex/private-beta-release`; clean worktree at both build submissions.
Render API deploy `dep-daq2od8u01pc73f5s18g` succeeded in 2m23s. Normal predeploy
applied `20260923000000_manual_intake`; no repair or test migration. Lifecycle
build `bld-daq2odgu01pc73f5s26g` uses the same exact commit. Health and readiness
both returned HTTP 200; database ready.

At 19:47:41Z, all seven persisted fingerprints above matched exactly, including
row counts. Enrollment remained false and all accounts retained known providers.
The additive tables contain zero usual preferences, overrides and manual states.

A temporary loopback-only Express harness on the deployed service exercised the
actual compiled selection, Today, History and manual-state GET routers with/without
the capability: **80 checks across 10 existing accounts passed**. It used explicit
existing users internally, not a new public authentication bypass. It proves
protocol/router behavior against deployed data; it does not replace physical
Clerk session qualification. History GET may invoke existing bounded recovery;
no fixture/manual account, source mutation or fabricated history was created.

A normal lifecycle run completed at 19:49:18Z: 10/10 accounts, failedCount 0.
Provider warning count was 6 versus 5 in the preceding scheduled run. Five Fitbit
connections already needed reconnection. One additional connection entered
`token_refresh_failed` in the unchanged Google Health token refresh implementation.
This is a newly observed provider warning, not counted as a clean no-warning run;
provider physical smoke remains required. Working Fitbit and FatSecret refreshes
completed. No new startup failure or manual/accounting failure was observed.

Exactly one build per platform submitted, both from the implementation commit:

| Platform | Version | EAS build | State at checkpoint |
| --- | --- | --- | --- |
| iOS | 1.0.0 (5) | 333e9a79-3d67-4990-aedd-bb3017ffd6c4 | Finished; TestFlight Friends & Family Testing |
| Android | 1.0.0 / versionCode 4 | 0f8fa9f4-7959-4ea4-98e3-08d9f8d2e051 | Finished; available to Internal Testing |

The capability-emitting feature floor is these new builds once qualified, not
Phase 1A's parser-only iOS 4 / Android 3. Selection must stay off until the
pre-enablement and existing-provider physical checkpoints pass. Distribution and compiled artifact inspection are recorded below. Real manual
account/capability rejection, physical accessibility and first real completed
manual day remain pending.

### Store/privacy checkpoint

Founder-approved calorie-estimates paragraph published at the unchanged public
Privacy Policy URL, effective September 23, 2026. The deletion page is unchanged;
new account-owned tables participate in the existing deletion cascade.

Google Play’s saved Data Safety form was inspected read-only: Health info and
Fitness info selected; Health info collected, not shared, non-ephemeral, required,
App functionality only. Manual estimates add no category or purpose to that
declaration. Health Apps retains Activity and fitness plus Nutrition and weight management,
with READ_NUTRITION as its existing health permission. No declaration edits were
saved. The Console also shows an existing
Advertising ID declaration needing attention; this is not evidence of advertising
being added by Phase 1B.

App Store Connect’s public App Privacy page is still “Get Started,” with no public
policy URL or completed data declaration. We do not claim an existing Apple
declaration is complete. Manual nutrition remains in the health-data category;
no new entitlement or collection purpose. Public App Store metadata completion
remains separate and requires founder approval before submission.

iOS build 5 finished and was uploaded successfully using existing EAS credentials.
Submission `67ce4896-9b6d-449e-965c-5531eca3b038`; Apple showed Processing at
September 23, 15:01 CDT. No public App Store submission.

Build 5 was assigned to the existing two-person external Friends & Family group
and submitted through the TestFlight beta-review flow. The existing Team (Expo)
internal group was automatically attached. No testers or public links were added.

The Friends & Family build table subsequently confirmed **1.0.0 (5): Testing**.
ASC build `4df4a435-a1c7-4854-a6b2-9508d10cd73d`. Founder iPhone update requested;
no physical installation or smoke result claimed yet.

Read-only inspection of the exact uploaded IPA confirmed bundle identifier
`com.caloriebank.mobile`, marketing version `1.0.0`, build `5`, non-exempt
encryption false, and unchanged read-only HealthKit usage descriptions. IPA
SHA-256: `27109d0d101c13e39f5a7e4cd54a22ced8622104d414f8e4e4e3e16dcc7fc48d`.
Its 7,013,751-byte compiled Hermes bundle contains the capability header/token,
UPDATE_REQUIRED handling and manual source identity. This ties compiled code to
the artifact; it does not substitute for observing a real authenticated request.

### Android compiled artifact

The single EAS AAB completed successfully from `9435eaf`. Read-only AAPT2 protobuf
manifest inspection confirms `com.caloriebank.mobile`, versionName `1.0.0`,
versionCode `4`, min SDK 26, target/compile SDK 36. Exactly one Health Connect
permission: `android.permission.health.READ_NUTRITION`; no health write, burn,
background or history permissions. Health Connect burn stays disabled.

AAB SHA-256: `35b837a440ee37b4071a4e11b1160c951d1946c340db0836819183676074491d`.
Upload certificate SHA-256 matches the prior qualified artifact:
`F2:EE:9D:25:B3:E5:E5:54:74:72:50:B1:43:FC:42:2D:96:5A:CD:8D:08:BB:AD:59:87:FB:9B:B4:CC:9C:17:5C`.
The compiled Android bundle contains the capability header/token and UPDATE_REQUIRED
handling. Installed-device provenance remains a separate physical check.

Google Play accepted versionCode 4 with no errors; the single warning is the
existing missing deobfuscation-file advisory. No supported-device loss. Published
only to the existing Internal Testing track at September 23, 15:20 CDT. Console
confirms **Active / Available to internal testers / Not reviewed**, release
`1.0.0 (4) — Friends & Family estimates`, release ID 3 on track 4701187796213670867.
No declaration modification was needed for this internal rollout. No Production,
Open Testing, new tester or public link.

## Qualification hold

Implementation and automated validation are complete at this checkpoint; backend
`9435eaf` is deployed, both exact private artifacts are available, but neither new
binary has been physically qualified. Manual selection is disabled for everyone.
Next founder action: update iPhone through TestFlight to 1.0.0 (5), preserving the
existing session. Continue one action at a time with existing-provider smoke on
both platforms before enablement. Then qualify real manual onboarding, edits,
reset, source transitions, offline/accessibility/account safety, capability stripping
and first real completed-day finalization.

**POST-ANDROID PHASE 1B: PASS CANDIDATE — physical qualification, controlled
private enablement and real manual-account/finalization evidence remain.**

This evidence-only commit uses `[skip render]`; it changes no compiled code or
validated backend/build source. Daily Eating Budget and all deferred polish remain
unimplemented.

## Founder iPhone smoke and navigation defect — September 23

Founder confirmed TestFlight 1.0.0 (5), existing session/Home, Available Bank
1,124, Today 3,671 from Cronometer, latest completed-day intake 2,097 from
Cronometer, Fitbit/Cronometer role cards, normal foreground refresh, Step Planning,
Morning Bank Update enabled, and session persistence after relaunch. Imported
Today correctly has no edit pencil; the source chooser correctly has no manual
choice while enrollment is disabled. VoiceOver announced 3,671; full source-label
and navigation accessibility qualification is not yet complete.

Read-only server inspection matched the existing account and exact Apple writer
`CRONOMETER-GOLD`. Opening Bank 224, Available Bank 1,124 and Recovery 0 were
stable across refresh. Opening evidence, finalized records/snapshots, ledger and
intake-boundary fingerprints were unchanged. No manual authority was created.

A separate Sep 21 correction remains an upstream export discrepancy: founder
reported Cronometer 4,934 while Apple Health and the latest CalorieBank snapshot
both contained 4,874. Export/read permission checks and Cronometer relaunch did
not change Apple Health. This does not prove a CalorieBank reconciliation defect
or successful physical correction; deterministic same-source coverage is separate.

The founder found a real navigation defect in Today detail: the header had no
Back control. Detail and Settings groups have nested stacks whose first screen
has no local previous screen, while the parent header is hidden. Added a shared
native-style, accessibility-labeled Back control that uses router history across
parents, with Today/Settings fallback for direct entry. Applied it to detail,
Settings and ledger-modal headers; removed the duplicate parent modal header.
Root tabs, sign-in and onboarding keep their existing navigation semantics.
No accounting, provider, manual-enrollment or Step Planning changes.

Validation: `release:friends-family` PASS, 905 tests across 81 files, including
three new navigation tests; TypeScript, lint, Prisma/local migrations and builds
passed. Isolated React Native Web rendering of the actual shared Back component
and React Navigation header checked 320/390 widths and 200% title size: Back
remained visible and announced as a button, and activation invoked return. Long
header titles retain the library's truncation behavior. This is rendered evidence,
not native iPhone/Android qualification. The fix is not in already-distributed
iOS build 5 or Android build 4; a consolidated replacement binary is required
under the genuine-defect exception before claiming navigation physically fixed.

Founder no longer has the Pixel. Android physical qualification will use the
incoming Samsung Galaxy, with exact Play package/versionCode/installer verified
before testing. Manual Intake remains disabled pending both platform provider
smokes and the pre-enablement checkpoint. Continue founder-assisted checks one
action at a time; do not enable Manual Intake or claim Phase 1B PASS yet.

### iPhone accessibility, offline and completed-day follow-up — September 24

Founder confirmed VoiceOver announced both the Eaten value and “Imported from
Cronometer.” At the largest accessibility text size, Today Eaten/provenance and
Step Planning inputs/results remained readable without overlap or clipping.
Preferred text size and VoiceOver state were restored afterward.

With Airplane Mode on and Wi-Fi explicitly off, the previously loaded 4,654 kcal
from Cronometer remained visible, including after backgrounding/reopening without
force close. After restoring connectivity, refresh worked and retained Cronometer.
This qualifies warm-cache provider behavior, not manual/offline editing or a cold
start. History then showed Sep 23 with 4,654 kcal from Cronometer; Home showed 0.

A read-only RepeatableRead server transaction confirmed Sep 24 local date,
Sep 23 provisional posting with intake 4,654, Cronometer exact writer
`CRONOMETER-GOLD`, and contribution -1,505. Previous effective balance 1,124 minus
1,505 equals -381: Available Bank 0 and Recovery 381 are therefore coherent.
One additional finalized record, calculation snapshot and ledger row exist since
the prior checkpoint. Opening evidence and stable initialization hashes are
unchanged; the authority-boundary hash is unchanged. This check does not claim
all older mutable provisional record fields are byte-identical across the nightly
lock transition. No manual state, override or authority exists. Physical display
of Recovery 381 remains to be confirmed. No mutation or lifecycle invocation was
performed during this inspection.

### iPhone provider round-trip — September 24

Founder confirmed Recovery 381 matches the server. Current-day intake advanced
from 1,158 to 2,051 kcal from Cronometer; Sep 23 remained 4,654 from Cronometer.
On TestFlight build 5, selected the already-connected FatSecret without another
OAuth sign-in. Today showed “No intake today” and “FatSecret has not reported
calories eaten today.” Sep 23 History remained 4,654 from Cronometer. Selected
Cronometer again; Today showed 2,051 from Cronometer and retained that source
after refresh and force-close/relaunch. No stale FatSecret overwrite was observed.

Read-only production transactions at 21:09:38Z (before), 21:12:18Z (FatSecret),
and 21:32:17Z (Cronometer again) confirmed America/Chicago Sep 24 authority.
The current-source projection agreed with the Sep 24 boundary at each stage.
FatSecret's boundary had no native writer; returning to Cronometer restored exact
`CRONOMETER-GOLD`. The same-date boundary was updated on switch-back, leaving one
Sep 24 boundary, the Sep 21 boundary and the legacy baseline. No duplicate or
competing same-date boundary was present.

Across both transitions, Opening Bank stayed 224, Available Bank 0 and Recovery
381. All four accounting fingerprints were identical (sorted JSON rows joined
with `|`, SHA-256):

| Persisted evidence | Rows | Fingerprint |
| --- | ---: | --- |
| Opening calculation days | 5 | `b8d5651ffc8336e346567d9b216fab7a80625785bd6803f736cde0aaf1e64ee0` |
| Finalized records | 14 | `74d12d3658aecfb77a728c70a30a14a0676ed4a6d1f65acec725ee49a713a2b2` |
| Calculation snapshots | 16 | `3d2ee7236428f08e656927709c85c3398c110a82ad1ca82124a470875fee2773` |
| Ledger transactions | 16 | `e5733069a198675630f9393e6d47698b0ab9eed7f2e7a3fd45f5bd3c9472179e` |

This completes the exercised iPhone existing-provider round-trip on build 5.
Navigation-fix replacement binary qualification and Android provider smoke remain
pending. Manual enrollment is still disabled; no manual physical journey or
Phase 1B PASS is claimed.

### Samsung installation and Settings chooser defect — September 24

Founder installed from the existing Google Play Internal Testing invitation using
an already-approved tester account. ADB read-only inspection verified Samsung
SM-A136U, Android 13, package `com.caloriebank.mobile`, versionName 1.0.0,
versionCode 4, installer `com.android.vending`. The package requests only
`READ_NUTRITION` among Health Connect permissions; this does not yet prove a
runtime grant. Existing-account sign-in and Home succeeded. The shared account
still selected Apple Health Cronometer, correctly requiring a local Android
source selection rather than silently replacing authority.

Physical Settings exposed a second real client defect: Add another source opened
an old Android screen headed “Choose your food tracker” but presented permission
and diagnostic actions instead of tracker choices. Onboarding already had the
approved recognizable choices. Settings now reuses that same consumer component:
Cronometer, MyFitnessPal, Lose It!, MacroFactor, another Health Connect app, then
FatSecret labeled Direct connection. FatSecret reuses a connected selectable
source through the existing role-selection path. Exact observed package identity
is still required before a native tracker becomes authoritative. No query or
source mutation occurs just from opening the chooser. Setup/permission guidance
appears after an explicit tracker choice; setup-required devices have an action
using the existing Health Connect settings/store handler. Old native-food route
links redirect into this chooser instead of retaining a second UI.

Tests cover the actual Settings journey, recognizable choices before permissions,
exact Cronometer package selection, connected FatSecret reuse, old-route entry,
and setup-required recovery without authority mutation. Prior shared chooser tests
continue covering denial, missing exact package, failed query and unmount/stale
work cancellation. Full release gate passed: 905 tests / 81 files, including
TypeScript, lint, dedicated local persistence/migration, Prisma and builds.
Isolated rendering used the actual sheet/choice components at 320/390 widths and
200% text, with scrolling to FatSecret and setup controls. No overlap observed;
scrolling is required for longer content. Native physical qualification remains
pending the replacement binary. No backend deployment, permission expansion or
manual enablement accompanies this fix. Consolidate it with the Back-button fix
for replacement builds under the genuine-defect exception.

### Samsung provider qualification via USB mirror — September 24

The founder authorized direct device operation to reduce step-by-step prompts.
The actual Google Play installation on Samsung SM-A136U was operated through
local USB mirroring and native UI controls, not an emulator or a different APK.
The founder granted CalorieBank Nutrition access and separately approved Cronometer
Nutrition export. Only Cronometer's Nutrition write toggle was enabled; its
follow-up request for activity reads was declined. CalorieBank subsequently
discovered Cronometer without fabricated diary data or a backfill operation.

Read-only RepeatableRead production inspections at 01:00:30, 01:02:03, 01:04:38
and 01:06:07 UTC on September 25 (September 24 America/Chicago) bracketed:
Apple Health Cronometer → Health Connect Cronometer → FatSecret → Health Connect
Cronometer. The September 24 boundary and compatibility projection agreed at
each successful transition. Health Connect preserved exact source identity
`com.cronometer.android.gold`; FatSecret's boundary had no native writer/source.
The boundary count stayed three (legacy baseline, September 21, September 24),
with no duplicate current-date boundary. Dormant provider identities in the
selection row did not become active authority.

Opening Bank stayed 224, Available Bank 0, Recovery 381. All four accounting
fingerprints matched the iPhone round-trip baseline above at every inspection:
five opening days, fourteen finalized records, sixteen snapshots and sixteen
ledger rows. September 23 retained Apple Health Cronometer provenance, Eaten
4,654 and contribution −1,505. The device's History detail showed the same values.

Samsung Home and Today detail showed 2,498 kcal imported from Cronometer. After
selecting connected FatSecret, Today settled to “No intake today” and “FatSecret
has not reported calories eaten today.” Returning to Cronometer restored 2,498
with correct provenance; values were not summed. Canonical Health Connections
cards agreed after the round-trip transitions. Returning from the old standalone
native-food screen initially left its parent card stale (“Source on another
device”); reopening Health Connections corrected it. The replacement chooser's
explicit selection callback reloads this state, but native confirmation in the
replacement binary remains required. This observation is not reported as a pass
for the old screen's immediate return behavior.

Fitbit remained the burn source. Today detail and the visible walk-target planning
card rendered normally without editing planning inputs. Morning Bank Update
displayed Off on this Samsung and was left unchanged; no notification delivery
claim is made. Add calories burned source showed “All supported sources are
connected,” with no Health Connect burn choice. Imported Eaten had no pencil and
the examined source chooser exposed no manual option. Manual selection remains
disabled. Manual journeys, Samsung accessibility/offline/relaunch qualification
and replacement-binary checks are still outstanding.
