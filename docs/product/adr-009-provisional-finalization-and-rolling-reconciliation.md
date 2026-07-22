# ADR 009: Provisional Finalization and Rolling Reconciliation

Status: Accepted  
Date: 2026-07-22

## Context

Connected providers can report late meals, delayed wearable totals, deletions, or corrected daily aggregates after a local calendar day ends. Waiting for all possible corrections would make Available Bank stale, while permanently locking the first post-midnight calculation would make the bank visibly wrong.

## Decision

Completed days use an `OPEN -> PROVISIONAL -> LOCKED` lifecycle.

- `OPEN` is the user's current local calendar day. It remains awareness-only and cannot affect the ledger.
- At the first eligible processing after local midnight, the completed day posts immediately as `PROVISIONAL`. The posting creates an immutable version-1 calculation snapshot and an immutable ledger transaction, so Available Bank changes immediately.
- A provisional day remains correctable for the next two complete local calendar days. A July 21 contribution therefore locks at July 24 00:00 in the timezone captured for that day.
- Each provider intake or total-expenditure change in that window creates a new immutable calculation snapshot. If the recalculated contribution differs from the current effective contribution, CalorieBank appends exactly one correction transaction for `new contribution - current effective contribution`.
- At or after `lockAt`, the day becomes `LOCKED`. Automatic provider reconciliation can no longer alter its effective contribution.

Existing ledger transactions are never edited. Available Bank remains the sum of initial and compensating ledger transactions. Steps, workouts, current-day awareness, Planning Database records, and activity estimates remain outside this pipeline.

## Rationale

Immediate provisional posting preserves the product promise that yesterday updates the bank promptly. The rolling window accepts common provider delay without delaying value. Two calendar days are a V1 product policy, not a claim that all provider data is complete after that time.

Immutable snapshots explain every effective contribution. Compensating transactions keep the ledger reproducible and prevent silent historical mutation. Durable PostgreSQL advisory transaction locks and database uniqueness constraints make posting and reconciliation safe under duplicate workers.

## Timezone And Processing

Day completion and `lockAt` use the IANA timezone stored with the imported day, never UTC midnight. ADR 010 adds scheduler-neutral orchestration and rolling foreground HealthKit synchronization. Product copy may describe the local-midnight boundary without promising an exact worker execution instant.

## Consequences

- Finalization reports store original contribution, effective contribution, status, lock time, correction count, and current version.
- Every contribution-changing calculation has an immutable version with source and sync-session provenance.
- Bank Summary and History return effective contributions and status while retaining original values and correction history.
- Goal mode, goal adjustment, adjustment rate, and calculation inputs are snapshotted at initial posting. Later goal-setting changes do not rewrite that day.
- Provider updates for locked days may remain auditable ingestion records but cannot automatically create ledger corrections.
- Existing finalized records are migrated as locked version-1 reports without changing their ledger amounts.

## Rejected Alternatives

### Immediately locked finalization

Rejected because late provider data would make yesterday's bank contribution permanently wrong.

### Delaying bank updates for two days

Rejected because the user should see yesterday's contribution immediately.

### Editing the original ledger transaction

Rejected because it destroys auditability and makes historical balances irreproducible.

### Recalculating locked days automatically

Rejected because it removes a stable historical boundary. Support/admin reconciliation for locked days is deferred and must use an explicitly authorized, auditable process.

## Deferred

- Administrative reconciliation of locked days
- Hosted background workers and exact midnight scheduling
- User notifications for provisional corrections
- Historical HealthKit querying beyond the rolling three-day window
- Manual correction UI
