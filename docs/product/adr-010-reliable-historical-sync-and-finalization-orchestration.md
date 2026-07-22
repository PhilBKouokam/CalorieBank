# ADR 010: Reliable Historical Synchronization and Finalization Orchestration

Status: Accepted and implemented  
Date: 2026-07-22

## Context

ADR 009 made completed days provisional and correctable, but reconciliation is only useful when fresh provider aggregates reach it. Current-day-only HealthKit queries leave yesterday dependent on a user remembering a special refresh and cannot reliably capture late nutrition or wearable updates.

## Decision

Foreground Apple Health synchronization uses a rolling three-local-calendar-day window:

1. Current day, for awareness only.
2. Yesterday, for initial provisional posting or reconciliation.
3. Day before yesterday, for reconciliation while eligible and locking when its window expires.

For each date, the iOS adapter independently queries active energy, basal energy, dietary energy, steps, and workouts. Each normalized category/date is uploaded independently. The mobile client fingerprints normalized values, skips previously accepted unchanged values, and retains changed uploads in an ordered AsyncStorage outbox until the API accepts them. Cumulative snapshots replace prior snapshots; they are never summed.

The API records one coordinated sync session containing queried, uploaded, skipped, reconciled, locked, waiting, and errored dates plus trigger and duration. Completing a session invokes `FinalizationOrchestrationService`. Manual, foreground, connection, scheduled, and integration-test execution use this same scheduler-neutral service.

The orchestrator coordinates existing accounting services. It does not calculate contributions. It asks the existing reconciliation pipeline to post or reconcile completed dates, asks the existing locking operation to lock expired records, and records durable per-day waiting states when inputs are absent.

## Missing Inputs And Retry

Missing values are never guessed, and zero is never substituted for absent intake or expenditure. A completed day may be recorded as `waiting_for_intake`, `waiting_for_expenditure`, `waiting_for_provider`, `waiting_for_sync`, or `waiting_for_required_inputs`.

Waiting records retain attempt time, attempt count, next retry time, timezone, sync-session provenance, and a redacted error code. Foreground sync, manual refresh, provider reconnection, and scheduled orchestration are retry opportunities. Mobile HealthKit queries use a five-minute cooldown; waiting-day orchestration records a fifteen-minute retry cooldown. Manual refresh may bypass the mobile cooldown.

## Timezone

The rolling window is calculated from the device's current local calendar and sends an IANA timezone with every aggregate. Day completion and locking remain governed by the timezone captured by the bank report under ADR 009. Travel does not move or rewrite an existing finalized record. A not-yet-posted date uses the timezone attached to the accepted aggregate; broader travel reconciliation remains deferred.

## Boundaries

- HealthKit remains device-only. The backend never queries Apple Health.
- Current-day data remains awareness-only and never touches the ledger.
- Only completed-day intake and total-expenditure aggregates enter reconciliation.
- Steps and workouts are synchronized as context but never affect banking.
- Existing immutable snapshots, delta corrections, advisory locking, and ledger idempotency remain authoritative.
- Locked days reject automatic provider reconciliation.
- No background HealthKit delivery or unlimited history import is introduced.

## Rejected Alternatives

### Current-day-only synchronization

Rejected because it cannot reliably post yesterday or capture corrections without a special user action.

### Full Health history synchronization

Rejected because it increases privacy exposure, device work, API traffic, and reconciliation ambiguity without helping the two-day correction policy.

### Scheduler-owned accounting logic

Rejected because it would duplicate the banking engine and create inconsistent posting paths.

### Guessing missing intake or expenditure as zero

Rejected because it can create false deposits or withdrawals.

## Deferred

- Background HealthKit delivery
- Hosted scheduler deployment and exact execution cadence
- Administrative reconciliation of locked days
- Unlimited historical import and analytics
- Cross-device outbox synchronization
