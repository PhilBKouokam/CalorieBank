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
