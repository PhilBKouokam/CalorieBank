# Manual / estimated Calories Eaten

Phase 1B is authorized and in implementation. Manual selection remains disabled
in the deployed private beta until the validation and distribution gates in the
[Phase 1B rollout](../deployment/manual-intake-phase1b.md) pass. This document is
the intended contract; implementation evidence is recorded separately.

## User model and truthful provenance

A calorie tracker is optional. “I don’t track calories” asks for the user’s usual
whole-day calorie estimate. The source is “CalorieBank estimate”, with no external
connection, native writer, OAuth, permission request or health-store write.
Manual estimates are first-class user input, not a provider failure fallback.

A usual estimate of 2,500 applies unless the user sets Today to another value.
Editing Today to 2,900 changes that date only. “Use my usual estimate” clears the
override. Tomorrow returns to the applicable usual estimate. No nightly app open
or confirmation is required. Input is whole kcal: usual 1–100,000, Today 0–100,000.
These are technical bounds, not advice or recommended intake. Zero is explicit
intake; missing configuration is different.

**Manual Today is estimated total-day intake.** It is not measured eaten-so-far.
Its provenance reads “Your daily estimate” or “Your estimate for today”, including
inside the existing Today-so-far card. No time prorating, inferred meals, activity
inference or fabricated eaten-so-far. Imported sources retain observed/logged
current-day semantics. The pencil edits only a manual current unposted day.

## Persistence and authority

[ADR 029](./adr-029-effective-dated-intake-authority.md) governs source boundaries.
Successful manual selection requires a valid estimate and applies atomically to
the current unposted canonical local date. Provider selection first establishes
the new provider under existing validation. Neither direction sums sources or
changes older authority. Connected providers may remain connected but inactive.

`ManualEstimateBoundary` stores the usual value effective from a local date.
Same-day changes replace that date’s preference; prior dates retain their value.
The usual estimate changes Today immediately only when no explicit override
exists. An override always wins. `ManualIntakeOverride` has one account/date key.
`ManualIntakeState.revision` serializes mutations; stale edits conflict rather than
silently restoring older values. Account-level locking is shared with source
selection and finalization. Date rollover rejects a save for yesterday.

Dormant preferences remain stored after switching to a tracker. Returning to
manual requires explicit confirmation of the estimate. A retained override for
the same local date remains that date’s value; it never applies to another date.
Nothing automatically resumes manual authority after provider failure.

## Accounting and initialization

Manual values feed the existing server-owned accounting formula; no new formula,
Fitness Goal behavior, Daily Bank Target influence or on-device finalization.
Current-day edits are ledger-neutral and do not change Available Bank, Recovery,
Opening Bank or Banking Goal progress.

Fresh manual onboarding initializes a prospective zero Opening Bank after normal
burn preparation. It never invents seven prior days of intake. An established
Opening Bank is unchanged by source or estimate changes. Late processing resolves
the usual estimate that applied to that date, then that date’s override if present.
Finalization snapshots the exact source/value/evidence revision. Posted source
snapshots remain stronger than current preferences. Manual data is stored in its
own tables, never as synthetic external-provider aggregates.

History uses “CalorieBank estimate”; no imported wording and no historical manual
editor. Existing exact-writer provider evidence and allowed same-source late
reconciliation remain intact. Historical corrections are a separate milestone.

## Client, offline and multi-device behavior

The server owns dates, authority and confirmed values. Every client reads the same
state. A mutation carries the expected revision and local date; a concurrent stale
save receives a recoverable conflict. A lost response can be retried without a
second logical override. Account changes reject stale in-flight responses.

Known confirmed Eaten remains visible during unrelated refresh failures. There is
no new offline mutation queue. Failed saves preserve the entered text for retry
and do not claim the new value was saved. Refresh continues Burn/Steps independently
and does not substitute another intake source.

Onboarding preserves Burn → Eaten/estimate → Fitness Goal → Daily Bank Target →
Preparation → Today. Settings edits usual values or changes sources. The editor
uses numeric input, select-on-focus, Save, Cancel and reset, with keyboard avoidance
and accessible labels. Imported users do not receive a manual Eaten pencil.

## Protocol, deletion and rollout

New requests advertise `intake-authority-v2`. A capability is protocol negotiation,
not account authorization. Clerk remains the identity boundary. Unsupported manual
source-bearing reads return `UPDATE_REQUIRED` before serialization; conflicting
writes reject before mutation. Known-provider legacy requests continue normally.
The Phase 1A parser floors (iOS build 4 / Android versionCode 3) do not emit the
capability. They must not be granted support by build-number assumption.

Manual state, usual boundaries and overrides cascade with the account under the
existing ordered deletion workflow. Same-email recreation has a new internal
identity and must not recover old manual data. No new analytics or health-store
writes. The founder approved the precise privacy paragraph in the
[publication proposal](../deployment/manual-intake-privacy-proposal.md); live
publication and current store-declaration comparison remain pending.

New selection is held behind a default-off server switch. Once manual records
exist, disabling enrollment must preserve capable reads, edits, finalization and
legacy protection. Rollback cannot remove understanding of manual authority.
Actual private build numbers and physical evidence must be recorded after delivery.

## Phase 2 handoff and scope

`AuthoritativeEaten` carries local date, calories, source, evidence version,
updated time and `semanticKind`: `observed_current_day_intake` or
`estimated_total_day_intake`. The tuple is returned together; consumers must not
combine a new number with cached provenance. Completed-day accounting consumes an
authoritative completed-day total regardless of its original observation kind.

**Daily Eating Budget must not interpret a 2,500 whole-day estimate at 9 AM as
2,500 already consumed plus more expected intake.** Preserve the semantic type;
no Phase 2 math is implemented here.

Daily Eating Budget, Home/Steps redesign, forecast changes, Banking Goal 2.0,
historical editing, global loading/keyboard polish, Commerce and Social remain
out of scope. Phase 1A’s generic unavailable-source copy, History recovery wording
and visible account-information findings remain backlog items.

## API and internal support

`GET /v1/me/manual-intake` returns capability-protected, authenticated account
state: `selectionEnabled`, `selected`, canonical `localDate`, `revision`,
`selectionRevision` and a nullable estimate (`value`, `usualCalories`, `overridden`).
`PUT` accepts one strict operation:

| Operation | Additional fields | Effect |
| --- | --- | --- |
| `select` | `calories`, `expectedRevision`, `selectionRevision` | Confirm usual estimate and atomically select manual authority |
| `usual` | `calories`, `expectedRevision`, `localDate` | Change the current/prospective usual estimate |
| `today` | `calories`, `expectedRevision`, `localDate` | Replace the one current-date override |
| `reset` | `expectedRevision`, `localDate` | Remove that date’s override |

No operation accepts a user ID. Successful writes return the resolved estimate and
revision. Stale revisions/dates return recoverable 409 errors; invalid input 400;
unsupported protocol 426. Saves do not trigger finalized accounting. Provider-only
mutation schemas remain closed to supported external providers; manual enrollment
has its own validated operation. The shared HTTP transport emits capability on all
requests and distinguishes update-required from authentication errors. A global
account-scoped notice presents the update message without signing out or clearing
confirmed data.

Support guidance:

- Change the usual value in Settings → Health Connections → CalorieBank estimate.
- Change only Today with the Eaten pencil; reset restores the applicable usual value.
- Return to a tracker through Manage sources; do not reconnect solely because an
  estimate was previously selected. A valid retained connection can be reused.
- “Update CalorieBank to continue with this account” requires a capable app update,
  not account recreation, sign-out or provider repair.
- A failed save retains the entered text for retry and leaves the confirmed server
  value unchanged. A conflict requires reloading the editor to see the latest value.
- No external food connection is expected for an intentional estimate user.

Dates follow the persisted profile timezone shared by read and mutation paths.
Travel updates prospective context through the existing foreground lifecycle;
stored date keys are never moved. Backtracking into an already-recorded or earlier
preference boundary rejects edits. The client refreshes on date rollover and clears
yesterday’s visible value rather than presenting its override as today while offline.
