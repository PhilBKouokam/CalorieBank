# Phase 1B implementation and private rollout

Status: implementation in progress. Nothing deployed or privately enabled by this
phase yet. Phase 1A remains the deployed foundation. This document distinguishes
planned gates from completed evidence.

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
- Additive migration `20260923000000_manual_intake` applied locally only.
- Initial protocol tests: 15 passing controlled HTTP tests.
- Initial persistence: usual history, override/reset, zero, retries, conflicts,
  enrollment hold, account isolation and cascade deletion pass.
- Initial accounting test: 2,900 override with 3,400 adjusted maintenance burn
  posts +500 once under concurrent calls; tomorrow returns to the usual value.
- Existing ADR 029 authority suite, including Cronometer 2,716 → 3,149, passes.
- Local release gate and database/route coverage completed below. Deployment,
  builds, full native UI and physical qualification remain pending.

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
The final compiled AAB manifest is still pending the one planned EAS build.

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
