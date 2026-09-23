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
