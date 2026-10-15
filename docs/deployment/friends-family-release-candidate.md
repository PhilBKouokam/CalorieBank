# Friends and Family Release Candidate - September 7, 2026

## September 8 physical-QA revocation

The September 7 PASS is revoked. Physical QA found notification preference/sign-out throttling and contradictory preparation success/error UI. See [release stabilization](./friends-family-stabilization.md). External distribution remains blocked until the corrected binary passes that checklist.

## Scope and baseline

PB.1, PB.2, Morning Bank Update delivery, Settings navigation, and notification-settings recovery were physically accepted by the founder before this audit. This pass is release polish, not a new milestone. Accounting, provider authority, lifecycle, identity/deletion ordering, push ownership, and notification delivery are unchanged.

## Findings and disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| P1 | Installed app/launch assets still used Expo placeholders. | Prepared the supplied CB artwork as an opaque 1024-square iOS icon, removed the illustrated tile/shadow, and reused it on launch. |
| P1 | Today bank/goal cards and SummaryCard repeated the Link-slot style-callback failure previously fixed in Settings. | Pressable now owns navigation and its styles directly; destinations and data are unchanged. |
| P1 | Goal form displayed raw exception messages. | Replaced them with consumer-safe load/save recovery copy. |
| P1 | Delete Account confirmation was not scrollable above the keyboard. | Added keyboard-adjusted scrolling, labeled confirmation input, and concise retry copy. Deletion semantics are unchanged. |
| P1 | Legacy `/ledger` deep link exposed a development placeholder. | Redirected it to the existing History surface. |
| P1 | Full workspace typecheck exposed three auth-test fixtures without NODE_ENV after the notification helper introduced Expo's global environment typing. | Fixtures explicitly declare test mode. Security assertions and production code are unchanged. |
| P2 | Health prompt, Today fallback, and Goal setup used implementation-oriented wording. | Small copy-only corrections. Goal settings no longer implies the goal changes measured burn. |
| P2 | Sign-in actions lacked explicit button roles; fixed-height composition could constrain larger text. | Added roles/state/labels and scrollable content without changing Clerk behavior. |

No P0 correctness/safety regression was identified in the inspected paths. No P3 enhancement was implemented. Public provider-ownership enforcement, notifications beyond the existing morning update, broader redesign, and production-scale infrastructure remain outside this release.

## Journey review

- Launch/auth: inspected app identity, hosted-build guards, application gate, Clerk hosted sign-in/sign-up handoff, cancellation/error copy, and navigation. Email verification, password errors, and their keyboard behavior belong to Clerk's hosted flow and remain physical QA.
- Onboarding: inspected all four decisions, saved connected/no-data continuation, exact-writer selection, automatic import attempt, initial bank state, retries/back navigation, and optional notification request. No selection or bootstrap logic changed.
- Connections: inspected role selection, reconnect/disconnect guards, foreground Apple Health refresh, source-specific errors, and missing-data states. Internal diagnostics remain a secondary beta troubleshooting action, not primary consumer content.
- Today: inspected known-bank precedence over recovery, signed-to-Enjoyed presentation, zero/recovery, current-data separation, customization, and card navigation. Numeric inputs and formulas are untouched.
- History: inspected normal/opening rows, missing dates, read-model messages, detail/source selection, empty/error states, and navigation. Opening positive-suffix selection and History mathematics are untouched.
- Settings/notifications: preserved the previously accepted row layout, notification copy and On/Off behavior, direct notification-settings recovery, 07:00-11:59 local eligibility, and durable send state.
- Account safety: inspected sign-out token detachment, account-scope resets, token reassignment transaction, deletion/provider/Clerk sequence, and cascading notification data removal. No behavior changes.

## Verification boundary

Use Node 20.20.2. Full API/persistence tests run against the newly isolated localhost database `caloriebank_rc_20260907`, never beta or the local application database. All 28 existing migrations applied successfully there; no new migration is part of this release. Temporary QA scripts and database credentials are not tracked.

Visual review used actual React Native components through React Native Web with mocked service/auth boundaries: 320px and 390px layouts, notification-denied recovery, deletion confirmation, sign-in, summary-card long values, and Settings with simulated 150% text size. Goal-form accessibility structure was also inspected. This is not native Dynamic Type, keyboard, VoiceOver, or full live-provider device testing. Other journey screens received code/state review and existing regression coverage rather than a claim of exhaustive device rendering.

Final automated gates: workspace TypeScript (API/mobile/domain/schemas), API/mobile lint, full API suite including persistence and mobile regression tests, Prisma generation/validation, API production build, Expo configuration/dependency validation, and staged diff check. The build must archive successfully from the committed release candidate before it is handed to testers.

## Physical install smoke check

1. Install the final preview on the registered iPhone. Confirm CB home-screen icon and branded launch screen.
2. Sign in or create a test account; verify hosted verification/cancel/back flow and permission sheets.
3. Complete onboarding with available or genuinely missing data; confirm understandable continuation and automatic hydration.
4. Confirm known Bank/Enjoyed values remain visible during a refresh warning, and tap Bank, contribution, Goal, and History navigation.
5. Check narrow/larger-text rendering and VoiceOver; open Delete Account on a disposable test account and confirm the keyboard does not hide its action.
6. Confirm Morning Bank Update settings, direct iOS Notifications destination, preference state, and existing push/account-switch behavior on the final binary.

No manual Render deployment is required: backend code, schema, and service configuration are unchanged. Existing repository auto-deploy behavior is not modified by this audit.
# Source-selection release hold

The previous candidate is superseded by physical source-selection failures.
Before another preview, run `npm run release:friends-family` against an explicitly
configured localhost `TEST_DATABASE_URL`. See the [state-machine gate](../engineering/source-selection-state-machine.md)
for automation, migration scope and the five remaining device journeys. Automated
success alone does not remove the physical release hold.

## Phase 2A initialization idempotency and accounting evidence (2026-10-15)

The previous initialization whole-table fingerprint difference remains
**HISTORICALLY UNRESOLVED — NO CURRENT ACCOUNTING DISCREPANCY DETECTED**.
Do not reinterpret a consistent new baseline as proof that the earlier change
was harmless. The old capture did not preserve field-level before-values.

The narrow local correction compares historicalOpeningNetCalories,
openingEffectiveBalanceCalories and eligibleDayCount under the existing account
transaction lock. Matching values issue no UPDATE and preserve updatedAt.
Legitimate bounded repair and opening-period selection remain unchanged. Tests
cover all 13 fields, whole-row hashes, absence of UPDATE queries, repeated and
concurrent checks, account isolation, deletion, and a required historical repair
followed by an idempotent check.

### Reusable read-only snapshot

Use `apps/api/src/scripts/capture-accounting-snapshot.ts` (or its compiled
`apps/api/dist/scripts/capture-accounting-snapshot.js`) with the service's
existing database configuration. Set `ACCOUNTING_SNAPSHOT_PATH` to a unique
absolute path outside the checkout, inside an owner-only directory. Set
`ACCOUNTING_SOURCE_COMMIT` to the exact deployed commit when RENDER_GIT_COMMIT
is unavailable. Run with Node 20. Never print, attach publicly, or commit the
result: it contains private account IDs and accounting values.

The procedure uses a RepeatableRead transaction with SET TRANSACTION READ ONLY;
it never calls application read methods that may trigger reconciliation or
locking writes. It exclusively creates a mode-0600 JSON file containing:

- Stable user identity and every initialization scalar field.
- Whole-row, accounting/state, and separate createdAt/updatedAt fingerprints.
- Per-account Opening Bank, finalized History, ledger and calculation-snapshot
  counts and fingerprints.
- Opening sums/counts, initialized-state requirements, date boundaries, ledger
  ownership and finalized-to-ledger reconciliation checks.
- Derived effective balance, Available Bank and Recovery using the existing
  formulas, without persisting or recalculating accounting.
- Database capture time, exact deployed source commit, and migration names,
  checksums and execution timestamps.

The first baseline was captured at 2026-10-15T01:37:15.653Z against deployed
360048ac5afcabf2ff0f4c2eeb61e25528b699ce: 10 accounts, zero consistency failures.
Canonical snapshot SHA-256:
`12a067068162c7d73b1e91916ce3b0301fe3d5f17fceeace5346a70b835b7060`.
An owner-only copy was retrieved outside Git and checksum-verified. The raw
snapshot and account values are intentionally absent from this document.

Before and after an authorized deployment, compare row identity sets and all
13 initialization fields. Report operational timestamp differences separately;
never simply exclude the initialization table. Investigate every significant
field change and related accounting fingerprint difference. Concurrent normal
activity can change records legitimately; do not suppress or presume such
changes harmless. Preserve both snapshots securely. A fresh capture may be
needed immediately before a later deployment; it does not replace this baseline.

Local validation: 37 focused tests across 4 files; full Node 20 release gate
1,053 tests across 100 files, TypeScript, lint, Prisma validation, safe local
migrations and API compilation passed. No new migration is required. This
correction remains local; no further deployment, lifecycle deployment or mobile
build is authorized by this evidence record alone. Resume only after founder
review of this checkpoint.

### Phase 2A resumed backend qualification — 2026-10-15 UTC

Founder-authorized correction source: `bca23fb2940a6779d2340041f679126eb4b2f609`.
The reviewed four-file correction was committed and pushed without private
snapshots or credentials. Build 13 contracts remain compatible; no new API
contract or migration was introduced by the idempotency correction.

API deployment `dep-db831pqj9qps73besltg` became live at 01:51:53 UTC on that
exact source. Health and readiness returned HTTP 200 with database ready.
Predeploy reported 39 migrations and no pending migrations. The previously
approved two additive forecasting migrations remain unchanged.

Read-only post-API capture at 01:52:49.313 UTC and post-lifecycle capture at
02:04:35.698 UTC match the secured 01:37:15.653 UTC baseline for all 10 accounts:
all 13 initialization fields, whole-row/state/metadata fingerprints, Opening
Bank calculation days, finalized History, ledger, calculation snapshots,
Available Bank and Recovery. Zero consistency failures; migration evidence
unchanged. Checksum-verified copies remain outside Git with owner-only access.
Post-API canonical SHA-256:
`84c7aadba62d39b49bc1b55e66c96e707a0240a0629232ad5928e699ea96fb8e`.
Post-lifecycle canonical SHA-256:
`ce102e1af85c125b97fd7e685fe1ece93654f74c2f6829219610a872801a3b6c`.

Eight accounts passed two ordinary initialization checks inside read-only
transactions without writes. Two entered the preserved pre-existing bounded
repair path; read-only intent inspection established that the candidate old
history dates would be excluded again, preserving retained opening dates and
contributions. No repair was executed by that probe. Subsequent normal lifecycle
runs exercised the existing repair path and the final snapshot confirmed every
initialization field and accounting fingerprint unchanged for all 10 accounts.
The older unexplained whole-table fingerprint remains HISTORICALLY UNRESOLVED —
NO CURRENT ACCOUNTING DISCREPANCY DETECTED; this is not proof it was harmless.

Lifecycle build `bld-db835p0m7kps73cs3ukg` deployed the same correction commit.
Manual and following scheduled runs completed at 02:00:42 and 02:02:35 UTC;
each processed 10/10 accounts, with zero failed account jobs. Both retained the
exact same seven provider/account/http_409 tuples as the preceding old-source
run. These are existing provider errors, not newly introduced failures.

The deployed Fitbit adapter's authorized current-day sync returned HTTP 200 for
minute, daily calorie and daily step queries; connection remained connected and
scopes unchanged. Daily calories remain authoritative. Planning provenance was
reported_interval with verified coverage null. Supplementary failure isolation
is automated regression evidence, not a deliberately injected production fault.
Apple sample-end bridge compatibility and session handling remain source/test
verified; new-device physical qualification remains pending.

Validated source retains the full Node 20 gate: 1,053 tests in 100 files, 37
focused tests, TypeScript, lint, Prisma, local migrations and API compilation.
One build per platform was requested only after backend qualification passed:
iOS build 14 `c4bc8a91-7e65-44a9-97cf-41f368ef66fe`; Android versionCode 14
`18f39fd7-fbf1-4403-83b7-4614afa63427`. Both use the exact correction commit.
Store distribution and physical qualification are not established by this entry.

### Physical qualification failure — build 14

Both EAS build jobs finished successfully from `bca23fb`.
iOS submission `9e00544d-9d74-449e-90d6-939761d19c51` uploaded successfully;
App Store Connect build `10a14368-d4c1-4070-aa39-067764fd6553` showed Testing
with Friends & Family assigned. No public release was performed.

The founder then reported that iPhone build 14 crashes immediately on launch.
This is physical failure evidence, despite the passing automated/backend gates.
Step Planning and live-text qualification could not proceed. App Store Connect
Crash Feedback showed no report at inspection; exact crash time, device/OS,
repeatability and native stack remain uncollected. Root cause is not established.

Android versionCode 14 completed and its signed AAB was downloaded. Its Play
Internal Testing draft contains release notes, but the artifact was NOT uploaded
and the release was NOT published before the iPhone crash report. Publication
is paused. Android physical qualification is pending. No replacement build,
speculative code correction, rollback or accounting mutation was performed.

Verdict: PHASE 2A: BLOCKED — iPhone build 14 crashes immediately on launch;
crash diagnosis is required before resuming physical qualification and Android
publication. Backend/accounting evidence above remains valid and separate from
this mobile failure. Preserve the historically unresolved fingerprint limitation.

### Build 14 crash established and narrow correction — 2026-10-14 CDT

Four retained iPhone crash reports and the connected-device console establish a
JavaScript invalid-hook-call failure. Live launch at 21:53:43 CDT reported
`ScaleAwareTabBar -> useTextLayoutScale -> useContext`; the fatal error then
passed through `ExceptionsManager.reportException` to the TurboModule abort.
The callback was passed as `tabBar={ScaleAwareTabBar}`. BottomTabView invokes
that callback directly inside SafeAreaInsetsContext.Consumer, outside a function
component hook boundary. This is the accessibility tab-label refresh change,
not evidence of a HealthKit, forecasting, provider or accounting failure.

The founder-approved correction renders the component from the callback:
`tabBar={(props) => <ScaleAwareTabBar {...props} />}`. Navigator and screen keys,
text refresh behavior, screen state and consumer layout remain unchanged.

The previous regression incorrectly used React.createElement on the callback,
masking the failure. The corrected harness invokes the callback directly inside
a context Consumer, matching the library contract. It reproduced the original
invalid-hook-call failure before the one-line correction and passes afterward.
An additional test invokes the callback outside rendering and verifies it returns
a React element without executing hooks. Focused coverage also verifies initial
bar rendering, selected route and navigator identity through font-size changes,
and real calorie-correction (add/replace) and usual-estimate editor draft/input
preservation. These rendered tests do not establish physical accessibility.

Android 14 contains the shared ScaleAwareTabBar code and must not be distributed.
Retain its existing AAB; replacement delivery requires corrected source. No
backend deployment, production migration or accounting mutation belongs to this
mobile correction. Existing backend qualification remains separate evidence.

Correction validation: Node 20.20.2 full release gate passed (1,054 tests across
100 files), including TypeScript, lint, Prisma validation/generation, migrations
against the dedicated localhost test database, domain/schema/API compilation and
`git diff --check`. Focused accessibility/navigation suite: 6 tests in 2 files.
Expo public configuration resolves SDK 54.0.0 with New Architecture enabled;
no lockfile, native dependency, entitlement, permission or backend change.
Android EAS metadata confirms versionCode 14 source is `bca23fb2940a6779d2340041f679126eb4b2f609`;
its compiled bundle contains ScaleAwareTabBar. It is affected shared source and
remains undistributed. Physical launch, forecasting and live text qualification
remain pending corrected artifacts; automated checks are not physical proof.

### Corrected private artifacts — qualification in progress

Correction source committed/pushed as
`14f3e1ea59bd74fb1d4366436b0fda32e5c2fa29` with `[skip render]`.
Exactly one replacement per platform was requested from that source:
- iOS build 15: `b43f8223-fda5-4454-94e6-53d8b8865b35`.
- Android versionCode 15: `3a4ead97-9f4a-4fbf-b6c8-38ceb8c484fd`.

iOS finished, submission `3779a21a-02a0-4e0a-9846-6835e62f609f` succeeded,
and App Store Connect build `c6d43264-a2ed-47a5-afd0-e2c29737d982` shows
Testing with Friends & Family assigned. No public App Store submission.
Founder physical evidence: build 15 opens on both initial launch and terminated
relaunch. This resolves the observed iPhone launch failure; forecasting and live
text qualification are separate and remain pending. Android 14 stays preserved
and undistributed; replacement Android delivery remains in progress.

Founder iPhone live-text evidence on build 15: unsaved draft preserved, text
unclipped, same screen/tab retained, and Save reachable with keyboard open after
changing system text size without restarting. The requested exercise covered
calorie correction and usual-estimate editors; no saved intake changes were
requested. These are founder-reported physical observations, not inferred from
rendered tests. Physical Step Planning remains pending both devices' startup.

Android versionCode 15 finished from the same correction source and was published
only to Google Play Internal Testing, release 12, on October 14 at 22:27 CDT.
Console shows Available to internal testers with one version code, 15 (1.0.0).
The only console warning is the missing deobfuscation file; no supported-device
loss was reported. Signed AAB SHA-256:
`8ca861eb251a64563705302c71f477eef9503cdf9a8ee6b83cb1dc922827910f`.
Preserved Android 14 SHA-256:
`844d616f17eef784ba89dd75b7b3629e69579398fc93bec55fc30a69dbe1d88f`.
VersionCode 14 was never uploaded. No public release, backend deployment,
production migration, or manual accounting mutation was performed in this
correction release. Android physical startup/accessibility and both devices'
forecasting qualification remain pending; no physical success is inferred from
artifact compilation or store availability.

### Final accessibility release — backend qualification, October 15

Validated source `3ff8b90438bd4851de74d6d009d8f4fcb4a4d3db` was committed
and pushed after scope and sensitive-data review. The full pinned Node 20
release gate was rerun successfully: 1,106 tests across 107 files, TypeScript,
lint, Prisma/local migrations and workspace builds. An unrelated untracked
root `app.json` was excluded from the source commit.

The immediate pre-deployment read-only accounting capture at
2026-10-15T20:36:25.323Z contains all 10 accounts and zero consistency failures.
Its canonical JSON SHA-256 is
`707893742f801ec767598fac86cb04fe86445dbfb01a032083aa4bf3c0277191`.
Compared with the original 01:37 baseline, all initialization fields and Opening
Bank evidence remain exact matches. One October 14 finalization and three
scheduled October 12 locks explain later ledger/History changes. Filtering
newly created records and reversing only the later lock metadata reconstructs
the original evidence hashes exactly. This does not resolve or relabel the
older historical whole-table fingerprint discrepancy.

Render API deployment `dep-db8jl7g473hc73802s20` became live at 20:45:06 UTC
on the exact validated commit. Predeploy applied only
`20261016000000_settings_revisions`, bringing the migration count to 40.
Readiness returned HTTP 200 with database ready.

The post-API read-only capture at 20:45:38.524Z matches the immediate baseline
for every account field, accounting evidence fingerprint and derived balance.
Zero inconsistent accounts. Canonical SHA-256:
`d339833caac72902dd73d26e978e41b837450606b7bd46aac40c0d92e4c40c0f`.
Private snapshots remain owner-only outside Git.

Lifecycle, live protected-contract checks, mobile distribution and physical
qualification remain pending at this entry; automated/diagnostic evidence is
not a claim that replacement store artifacts have passed physical testing.

Lifecycle build `bld-db8jo1g473hc7380cg6g` succeeded at 20:49:30 UTC on
`3ff8b90438bd4851de74d6d009d8f4fcb4a4d3db`. The qualification run has not yet
been triggered/verified: computer control paused when the Mac locked. No mobile
builds started at this checkpoint.

The subsequent scheduled lifecycle run completed at approximately 21:02:40 UTC:
10 accounts, 10 completed, zero failed jobs, eight provider errors. The preceding
scheduled run reported seven provider errors. A newly observed Fitbit HTTP 409
requires read-only connection-status investigation; causality is not established.
No reconnection, credential change or provider repair has been attempted.
Mobile builds are held under the release failure policy.

The post-lifecycle read-only accounting capture at 2026-10-15T21:03:20.371Z
exactly matches every account in the post-API capture, with zero inconsistent
accounts. Its canonical JSON SHA-256 is
`9525efc5699b97962fd9866eae9976072b98d2373c25bcafa0daa895246750a5`.
The verified snapshot remains outside Git. This accounting result does not
resolve the additional provider failure. Live settings-contract qualification,
new private binaries and their physical qualification remain outstanding.

Read-only follow-up established that the additional failure belongs to the
founder-designated test account (identity retained outside this document).
Connection metadata: last successful sync 20:02:26.711 UTC; last token refresh
19:03:13.326 UTC; access-token expiry 20:03:12.326 UTC; recorded refresh-token
expiry 20:36:03.326 UTC. At 21:02:39.952 UTC the connection was updated to
`needs_reconnect` with `token_refresh_failed`. The existing accessToken guard
then explains HTTP 409 for subsequent requests. The Google Health service has
no diff between checkpoint 083f995 and this release source. Recorded expiry
supports expired authorization but does not establish the provider's exact
refresh rejection response. No tokens were printed or changed by investigation.

Release remains BLOCKED on this genuine connection failure under the founder's
failure policy. Reauthorization and successful provider qualification are needed
before resuming mobile delivery. No repair, permission expansion or replacement
build was performed. Accounting remains verified unchanged as recorded above.

Founder completed the existing Fitbit reconnection flow. Read-only verification
confirmed the designated test account owns the connected record, error code is
null, and successful synchronization completed at 21:56:54.031 UTC. New recorded
refresh-token expiry is October 22 at 21:56:43.725 UTC. Today has ready expenditure
and steps aggregates with coherent sync-session identity and reported-interval
planning evidence. Founder confirmed the reconnect warning cleared and Today
shows updated Burned and Steps. No credentials, permissions or connection records
were manually changed by the release investigation.

Post-reconnection accounting capture: 21:57:50.758 UTC, ten accounts, zero
consistency failures, canonical SHA-256
`db108cb6d4a989d0efb191e3cee4e3622ed35a0b5ae857fd42972c23220873f2`.
All initialization and Opening Bank evidence remains unchanged. One newly
finalized October 14 day explains the sole account difference. Removing only
records created after the earlier capture reproduces all previous History,
ledger and calculation fingerprints exactly. The new snapshot remains private
on the service; export through console was blocked by automatic approval review
and was not retried. Earlier secured local baselines remain intact.

The reconnection blocker is resolved. Private artifact preparation may resume;
new-artifact physical startup, settings conflict UI, accessibility and forecasting
qualification remain pending. Successful reconnect does not by itself prove the
next eventual token refresh will succeed.
