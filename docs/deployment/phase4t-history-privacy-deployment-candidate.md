# Phase 4T — production-base History logging correction

October 23, 2026. **Local candidate ready for bounded deployment approval.**
Nothing deployed. Base is exactly qualified API/worker production source
0a42656487a8f711c59cbed8579c17b924b68328.

Only runtime file changed:
`apps/api/src/modules/bank-history/bank-history.repository.ts`.
The two History-gap events no longer emit local dates. The existing Opening Bank
repair event emits repaired-day count instead of an account suffix, date array
and calorie balance. Event classifications and operation counts remain useful.
All database operations, calculations, return values, source authority, locks,
authentication, deletion and retry behavior are unchanged.

Supporting files: the existing bank-history and opening-bank-recovery persistence
tests assert exact diagnostic allowlists while preserving their accounting/history
assertions. The continuity fixture includes one date outside the eight-day retry
window. This document is the only additional file. No env, package, native, schema,
migration or feature-flag change. Specifically excludes the later release branch's
local OAuth pause and accounting-snapshot tooling changes.

## Fresh qualification

Exact Node 20.20.2 with its npm binary and PATH; dedicated localhost core test
DB verified before execution, with exactly 40 completed migrations. Full workspace
lint, type checks, API compilation and **1,154 tests across 112 files passed**.
This count is appropriate to the production base; the separate a9ebb42-based
version passed 1,192/115 and is not substituted for this source's qualification.
Both optional features remain absent/off; no reserve migration was run.

## Approval scope and execution preconditions

Approve only this exact candidate on the Render API and hourly worker, after
freshly checking both live sources are still 0a42656 (or requalify a changed base).
The shared repository is used by both services. No accounting change, permissions,
credential change, mobile artifact, migration or optional-feature rollout.

Before execution: verify full diff and clean candidate, health/readiness and database
compatibility, then capture sanitized read-only accounting/lifecycle fingerprints.
This log-only update needs no incompatible schema transition or deletion-safety
rollback. Preserve the existing qualified lifecycle boundary.

After an approved deployment: confirm exact service commits, health/readiness and
unchanged accounting apart from legitimate scheduled work. Observe the next natural
worker execution without repeated forced runs. Do not manufacture a provider refresh,
health notification, accounting change or Opening Bank repair to produce an event.
If the three affected events do not naturally occur, report structural regression
proof and the lack of runtime-event evidence separately. Historical copies remain
a separate access/retention issue; this does not erase them or certify all logs.

Failure: stop and preserve evidence; prefer a narrow forward correction. The old
0a42656 source retains the qualified deletion fix but would reintroduce these log
fields; any rollback needs an explicit privacy/operational decision. No automatic
production rollback or deployment is part of this preparation.
