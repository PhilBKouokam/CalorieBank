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

### Consolidated replacement addendum — September 24 (in progress)

Manual selection remains disabled. The replacement pair must include Back
navigation, the Android tracker chooser/return-state reload, startup state,
cross-device source presentation and the safely qualified Fitbit freshness work.
No replacement build, deployment or enablement has occurred at this checkpoint.

**Startup diagnosis:** a selected provider with no current-date aggregate and no
current-date ingestion session fell through to `not_connected`. In addition,
Home sampled lifecycle activity on focus/completion but did not subscribe to its
start. The server now distinguishes configured-but-awaiting-evidence from no
source, and Home receives lifecycle start/stop events. In-progress work hides old
refresh errors; confirmed same-date values remain visible. Cached observations
are accepted only for their canonical date. Failed new-date reads show a refresh
error, never yesterday's intake or a permanent loading state. The connection CTA
requires canonical missing/needs-attention source state, after loading finishes.
Temporary refresh failure alone does not imply a disconnected provider.

**Cross-device diagnosis:** the client intentionally replaced a selected native
source's label with “Source on another device” and forced `needs_attention` when
its transport was unavailable locally, even though the server retained exact
authority and valid data. Android also replaced Apple source labels globally.
Presentation now preserves the server label and health state, with “Updates from
Apple Health on iPhone” or “Updates from Health Connect on Android” and an explicit
Change source action. Local HealthKit permission composition no longer applies
to remote Health Connect sources. Local native permission failures still require
attention. Manual/server-owned authority has no remote-device label. These are
presentation changes, with no authority, ledger, Opening Bank or History writes.

**Fitbit evidence boundary:** the founder observed September 23 raw History burn
5,186 versus the provider UI's 5,271. Read-only production inspection at
2026-09-25T01:43:47Z found raw 5,186 / adjusted 4,149 in both the aggregate and
the sole September 23 snapshot. The snapshot was posted September 24 at
15:03:18Z. The aggregate's latest completed foreground fetch was September 25
01:13:58Z, in a completed session querying September 24/23/22 and reconciling
September 23/22. Thus the persisted value was recently refreshed, not merely an
unrefreshed midnight snapshot. The posting-trigger session was a separate native
sync with expenditure unavailable; its timestamp is not the original Fitbit fetch.

A direct authenticated cloud read at 01:44:27Z returned HTTP 200 and
`kcalSum=5185.987776` for exactly September 23 → September 24 civil dates. This
rounds to 5,186 before the 0.8 adjustment. Follow-up reads at 01:45:01Z returned
the same value from `google-sources` and `google-wearables`; changing source
families would not resolve this observed discrepancy. No health/accounting writes
were performed by these inspections; credentials and full provider payloads were
not printed. At this checkpoint CalorieBank matches the fresh cloud API, while the
founder's observed provider UI total differs by 85 rounded kcal. The founder subsequently refreshed the provider UI for September 23 and
confirmed it still displayed 5,271. This is founder-observed physical UI evidence
paired with the timestamped cloud reads above, not a simultaneous instrumented
read. The evidence does not yet distinguish upstream
latency from a provider UI/API calculation difference; it does not prove the API
ever revised this date to 5,271. No such claim or fake parity adjustment is made.

Both foreground and scheduled refresh use Google Health v4
`users/me/dataTypes/total-calories/dataPoints:dailyRollUp`, one civil date per
request, `all-sources`, and `totalCalories.kcalSum`. Normalization rounds raw kcal
then applies the existing 0.8 policy once. `providerUpdatedAt` for this adapter is
the fetch timestamp, not an upstream revision timestamp. See the official
[total-calorie rollup contract](https://developers.google.com/health/reference/rest/v4/TotalCaloriesRollupValue)
and [source-family definitions](https://developers.google.com/health/filters).
The code audit found a separately reproducible issue: the five-minute throttle
could span local midnight. It now requires the prior sync to belong to the same
local date, so a pre-midnight observation cannot suppress the first completed-day
query. Explicit foreground/manual refresh already bypasses this throttle.
This correction is not attributed to the reported September 23 discrepancy.

ADR 009 already posts provisionally and accepts same-source revisions for two
full local days through new snapshots and append-only ledger corrections.
It then locks permanently. No change to that accounting contract is proposed.
Dedicated database regressions cover 5,186 → 5,271 before posting, after provisional
posting, concurrent retries, and a later revision after the Chicago midnight lock.
Original ledger entries remain identical; retries produce no duplicate effect;
locked accounting remains unchanged. Provider-service coverage proves explicit
fresh retrieval and the first scheduled post-midnight query. These are automated
evidence, not a claim of physical provider/UI parity.

History day details now explicitly say “May still update as your source syncs”
while provisional. Locked bank snapshots remain historical calculation evidence;
the implementation does not claim that a provider can never revise its own data
after CalorieBank's existing lock. Extending that window or revising locked
accounting is not authorized by these changes.

The full release gate passed 931 tests across 85 files, including capability,
provider, authority, accounting, local migration, TypeScript, lint and API builds.
An earlier run caught an obsolete refresh-error copy assertion; a subsequent run
hit a database test timeout while all-platform Metro export was competing for
resources. The uncontended full rerun passed without increasing test timeouts.
Autolinking and store-profile Expo configuration passed; Health Connect remains
READ_NUTRITION-only, with burn/activity reads blocked. All-platform exports passed.
After visual inspection, the large-text per-value loading label was shortened to
“Loading…” to avoid truncation; final validation includes that last copy change.
Actual RoleCard and Home metric JSX/styles were rendered in isolated browser
fixtures at 320px/200% text and 390px/normal text. The new platform hint wraps
without overlap; the shortened loading state remains visible alongside confirmed
burn. This is rendered evidence, not replacement-binary physical qualification.

The final release gate after the loading-label adjustment and provisional-detail
note passed again: 931 tests / 85 files. At September 25 01:52:15Z the deployed
backend remained `9435eaf`, selection enablement was false, and production had
zero manual authority boundaries and zero manual selections. This replacement
requires no new migration or accounting changes.
The 01:51:55Z predeployment inspection retained all four accounting fingerprints
from the Samsung round-trip, with unchanged 224 Opening Bank / 0 Available Bank /
381 Recovery and unchanged active Health Connect Cronometer boundary.

Remaining before replacement qualification: completion and private distribution
of the submitted consolidated binaries, followed by physical checks on those
artifacts. The refreshed provider UI/API discrepancy remains an identified
evidence limitation, with its upstream cause unresolved. Exact provider UI/API parity cannot yet be
promised. Manual account qualification and capability rejection against real
manual records remain later Phase 1B gates, not completed by this addendum.


### Replacement deployment and build submission

Validated implementation commit: `d2eda4da1e60f39818eeb5b9c680b43cbb3de2c1`.
Render API deployment `dep-daqt7s3bc2fs738ej9fg` became live on this commit;
lifecycle build `bld-daqt7s3bc2fs738ej9r0` uses the same source. No new migration
was required. Health and database readiness returned HTTP 200. At
2026-09-25T01:56:16Z, deployed provider repository reads succeeded without
capability metadata, selection enablement remained false, and there were zero
manual authority boundaries. The 01:56:29Z accounting comparison retained all
four predeployment fingerprints. These are server checks, not replacement-client
physical qualification.

Exactly one replacement per platform was submitted from that implementation:

| Platform | Version | EAS build | Submission state |
| --- | --- | --- | --- |
| iOS | 1.0.0 (6) | `a2129ff1-5105-4bd6-9d5d-9de7436a5bb3` | Finished; Friends & Family Testing; physical qualification pending |
| Android | 1.0.0 (5) | `896c9f4c-0a41-4186-9f28-a89f94d8f082` | Build in progress; not yet qualified |

Manual Intake remains disabled. No public release has been made. Store
availability, artifact inspection and replacement physical evidence are pending.

The first observed scheduled lifecycle on the replacement backend completed at
2026-09-25T02:02:52Z: 10 accounts completed, zero failed accounts, five provider
errors. The previous hourly run also had 10 completed, zero failed and five
provider errors. The inspected existing Fitbit HTTP 409 warning remained present;
these counts do not imply every provider credential is healthy. The qualification
account completed with zero errors and zero unresolved dates. Render reported the
cron run finished successfully at 02:02:55Z.


iOS build 6 completed and EAS submission
`f49dc863-d50f-4586-a13e-1918227af1fc` uploaded it to App Store Connect.
The exact IPA identifies `com.caloriebank.mobile`, marketing version 1.0.0 and
build 6. Its compiled JavaScript contains `intake-authority-v2` and the new
cross-device presentation; bundle SHA-256 is
`960b1150393bf5e85cf58c460b36a9a7f0049085f9405fac0951b05f5db33eb8`.
App Store Connect build `e6d4a4e1-8609-44b2-9e1b-c2d83aa2f862` reports Testing
with Friends & Family assigned after the private beta review submission.
The founder has been asked to update through TestFlight; no physical build-6
result is claimed yet. No public App Store submission occurred.

### Replacement iPhone startup qualification — in progress

Founder confirmed TestFlight 1.0.0 (6), existing session retained and Home opened
normally. Read-only production baseline at 2026-09-25T02:19:26Z (September 24,
America/Chicago) retained all four accounting fingerprints and the authority
fingerprint above: Opening Bank 224, Available Bank 0, Recovery 381; 14 finalized
records, 16 snapshots and 16 ledger entries. The active source remains Cronometer
via Health Connect, exact package `com.cronometer.android.gold`, selected during
the Samsung journey. Opening iPhone build 6 did not replace that account authority
with Apple Health. The September 23 source/value snapshot remains unchanged.
At 02:19:40Z the deployed commit was `d2eda4d`; Today repository reads reported
both Fitbit burn and Health Connect intake ready. Manual selection remained false
and manual authority boundary count remained zero. These server statuses do not
prove every transient client startup frame. A cold-relaunch visual observation is
the next physical check; a natural new-local-day startup is not yet qualified.

### Founder-blocking duplicate tracker presentation — build 6

Founder physically confirmed cold relaunch preserves values/shows loading without
Not connected, Review Health Connections or a transient error. This passes the
observed same-date cold-start check, not a natural midnight rollover.

The next Health Connections check exposed a consumer presentation defect:
Cronometer appears twice, once as the selected Health Connect source and once as
an Apple Health alternative. The founder rejected both the duplicate app choices
and asking ordinary users to manage the cross-platform transport distinction.
The requested presentation is one recognizable tracker choice, with native setup
on the current platform (Apple Health on iPhone, Health Connect on Android).

Do not fix this by choosing authority on app launch, merging provider totals, or
changing historical source identity. A single tracker row must retain the actual
selected account authority; device-local setup belongs behind that row's Manage
flow. An explicit successful local setup may make the existing ADR 029 transition.
Automatically accepting evidence from both transports is a separate authority
policy and is not established by grouping rows. This physical defect remains open;
build 6 cannot yet be declared replacement-qualified. Manual selection stays off.

### September 25 recording: unresolved September 24

Founder recording at approximately 10:15 local time shows September 24 as
“CalorieBank is missing data for this day”; opening it offers Cancel/Try again
without identifying the missing source. Available Bank remains 0 through
September 23 and Recovery 381. This is not evidence of a new ledger mutation.

Read-only server inspection at 2026-09-25T15:20:55Z confirms the selected source
is still Health Connect Cronometer. September 24 Fitbit evidence is completed-day
(`isCurrentDay=false`) and was refreshed at 15:15:51Z. Health Connect intake for
September 24 remains current-day evidence, last observed at 02:14:36Z (September
24 at 21:14 Chicago), before that day ended. The latest Health Connect sync is
that same successful pre-midnight session; September 24 has no posted record.
Apple Health evidence for that date is also a pre-midnight observation and is not
the selected date authority. Manual selection remains disabled.

The immediate missing input is a post-midnight exact-date intake query from the
selected Android transport. An iPhone refresh cannot query Health Connect. Do not
substitute Apple evidence, infer a completed total from the last partial value,
or rewrite September 24 authority. The generic retry UI fails to explain this
required device/source recovery and remains an open qualification finding.

After founder opened Samsung, Health Connect uploaded completed-day September 24
intake at 2026-09-25T15:23:38Z (`isCurrentDay=false`, successful session). By
15:24:31Z one September 24 finalized record existed. Its intake is 2,498 from
Health Connect and contribution is -344. Opening Bank remains 224, Available Bank
0, and Recovery moves from 381 to 725. One snapshot and one ledger row were added;
the previous 16 snapshots and 16 ledger rows retain their exact fingerprints.
The prior finalized-record whole-row fingerprint differs (metadata/lifecycle
fields not yet compared); no assertion that every prior row is byte-identical is
made. Opening provenance fingerprint is unchanged.

The current selection now reads Apple Health Cronometer with a September 25
boundary; September 24 still snapshots Health Connect. Founder confirmation of
an explicit iPhone source selection is pending before attributing that transition.
No further source switches are requested pending this clarification. Manual
selection remains disabled.

### Additional physical findings: Back spacing and History chooser

Founder confirmed Back navigation works on iOS build 6, but its chevron is
visually left-biased within the rounded container. Track balanced padding/icon
centering as an open visual defect while preserving the accessible touch target.

Founder confirmed the September 25 Apple Health selection was intentional.
After Samsung recovery, iPhone History refresh displayed September 24 -344 and
Recovery 725 as expected. The new 10:30 screen recording additionally reproduces
the duplicate-tracker defect in History: September 24 detail -> Calories eaten
Change opens two identically labelled Cronometer rows, one checked, with no
visible distinction. The previously recorded duplicate-choice defect therefore
covers both Health Connections and the historical source chooser. The clip shows
no changed intake/contribution after dismissal; it is not proof of a server-side
mutation or of its absence. Do not ask the founder to choose either ambiguous
historical row. Any correction must retain exact per-date source identity and
must not turn UI deduplication into a historical source/accounting mutation.
Manual Intake remains held; replacement physical qualification is incomplete.
