# ADR 029: Effective-dated intake authority and compatibility bridge

Status: implementation contract; qualification pending (Phase 1A).

## Scope and supersession

This supersedes ADR 016's global-selection reconciliation rule **for intake only**.
An ordinary intake selection must not reinterpret completed dates. Expenditure
selection, exact historical override endpoints, same-source provisional corrections,
permanent locking, once-only 80% adjustment and immutable transactions are unchanged.
No manual intake UI, records, selection value or calorie estimate is enabled here.

## Three distinct facts

Current selection answers which source to use now. Effective-dated authority
answers which exact source owns an unresolved local date. Calculation snapshots
answer which source and value actually produced a posted contribution. Connection
health is separate from all three; loss of credentials never changes authority.

Use ordered, account-owned intake authority boundaries. Each boundary owns the
half-open interval until the next boundary. A unique account/local-date key makes
overlaps unrepresentable without storing redundant end dates. Exact Apple Health
writer and Health Connect package identities are part of authority; names are not.
A nullable baseline boundary preserves the pre-migration unresolved-date fallback
without claiming a historical selection date. Existing snapshots are not backfilled
or relabeled. The current ProviderSelection remains an atomically maintained
compatibility projection, not independently writable historical truth.

## Transition and date rules

A successful explicit switch takes effect immediately for the current canonical
local date. This matches existing Today behavior and future daily-estimate UX.
Prior completed dates are unaffected. Same-day switches replace that date's boundary;
identical retries are no-ops. Selection and posting must share an account transaction
lock, then acquire any day lock in that order. A finalized snapshot's source cannot
be replaced by a concurrent ordinary selection.

Dates are civil dates in the existing persisted user timezone. Store the timezone
and timestamp at the boundary; never reinterpret prior boundaries after travel.
A backwards calendar transition must not replace a later already-established
boundary or a posted date. Reject an ambiguous backwards source switch with a
recoverable conflict rather than rewriting historical authority. DST changes the
length of a day, not its authority key.

## Resolution precedence

Locked days and initialized Opening Bank use immutable snapshots. For provisional
posted days, retain the snapshotted exact intake identity while allowing late evidence
from that same identity under ADR 009/024. Existing explicit exact-date historical
source overrides retain their separately authorized precedence. Unposted completed
and current dates resolve the boundary for their local date. No arrival order or
refresh failure selects a source.

Incomplete Opening Bank preparation remains the existing bounded historical import
exception: current explicitly selected provider evidence may establish its historical
window via preparationSourceKey. This is not an initialized-bank rewrite, and must
not later authorize retroactive manual-estimate evidence. A future manual boundary
cannot imply intake on any earlier date.

## Compatibility and rollout

Known domain providers and mutation validators remain closed. Mobile response
validation must accept bounded future intake identities while provider-specific
operations require an explicitly recognized provider. Unknown identities retain
numeric Today/History values, receive truthful neutral presentation, and cause no
automatic selection, reconnection or intake upload. Known-source UI is unchanged.

Phase 1A emits known sources only. Old binary schemas must be exercised unchanged
against representative API responses. Distribution alone does not retire old devices.
Phase 1B requires a protocol capability gate on **reads and writes**, not merely an
account's enrollment build. A source-selection version floor alone is insufficient:
a user can sign into the same account on an old device. No unsupported source may
reach an old successful-response parser. Define and qualify a safe update-required
error response on existing client error paths before enabling any future source.
A capability declaration selects a protocol; it is not authentication or permission.
Clerk ownership and strict server-side mutation validation remain mandatory. Do not
rely on a user-agent or unverified version claim as a security boundary.

Sequence: qualify Phase 1A backend and both compatibility binaries, distribute via
TestFlight/Play private testing, record their actual version floors, then stop.
Phase 1B needs separate founder authorization and a qualified mixed-device gate.
No forced global update and no manual source exposure occur in Phase 1A.

## Migration, deletion and rollback

Add only metadata and indexes. Backfill a single baseline from persisted selection
with deterministic uniqueness; never touch accounting tables. Account deletion
cascades boundaries after the existing provider-cleanup sequence. Before/after
populated fixtures must prove byte-equivalent accounting and source snapshots.

Once prospective transitions occur, an old backend ignoring boundaries is unsafe:
it could apply current intake backwards. Emergency rollback must retain the
resolver and suspend source mutations/lifecycle as necessary; do not roll back to
ADR 016 intake semantics. The legacy projection alone does not make rollback safe.

## Required evidence

Qualification requires migration invariance, no-overlap constraints, concurrent
and duplicate transitions, exact-writer changes, same-source Cronometer 2716→3149,
midnight/DST/travel, prior-date lifecycle, failed switch, deletion/isolation,
legacy schemas and rendered unknown-source no-write journeys. Full release gate,
platform permission checks, backend health and real iPhone/Pixel private-distribution
qualification remain mandatory. This contract is not evidence that those gates passed.

### Hosted cutover

Hosted material intake transitions default to a temporary rollout hold until both API and lifecycle execute the period-aware release. A migration-only baseline follows legacy selection until the first dated transition, which atomically freezes the prior identity; this accommodates in-flight old-instance writes during deployment. Once a dated boundary exists, baseline and dated rows determine unresolved historical authority. See the deployment plan for the activation and rollback boundary.
