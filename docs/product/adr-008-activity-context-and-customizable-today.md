# ADR 008: Activity Context And Customizable Today Dashboard

## Status

Accepted and implemented for foreground current-day Apple Health awareness. Physical-device HealthKit QA remains required.

## Context

Available Bank and the latest finalized contribution answer what has already reached the immutable ledger. Users also benefit from current-day context, but steps, workouts, current expenditure, and current intake are incomplete and must not look like bank transactions. The dashboard must remain bank-first while allowing users to remove supporting cards they do not value.

## Decision

Today uses this fixed default order:

1. Available Bank.
2. Latest Finalized Contribution.
3. Today So Far.
4. Planned Treat.
5. Steps Today.
6. Logged Workouts.
7. Current Goal.

Available Bank is mandatory, always first, and cannot be hidden. The six supporting cards are visible by default and may be hidden through account-level preferences exposed by `GET` and `PATCH /v1/me/dashboard-preferences`. The first customization version changes visibility only; drag-and-drop ordering is deferred.

Steps and workouts are activity context, not calorie-bank inputs. `StepProvider` and `WorkoutProvider` extend the provider-neutral adapter boundary. Apple Health is the first concrete implementation. Step snapshots are cumulative and replace older snapshots for the same user, provider, and local date. Workouts are normalized and idempotent by user, provider, and provider workout identifier.

Observed workout history is separate from future Activity Opportunity recommendations. Logged workout calories are descriptive and already represented in Apple Health active energy. They must never be added to active energy, adjusted expenditure, or the ledger.

The authoritative raw current-day expenditure remains:

```text
active energy + basal energy
```

The existing centralized 80% adjustment is applied once to that total.

## Sync Sessions

Foreground sync is coordinated across expenditure, intake, steps, and workouts. One durable sync session records:

- Provider, local date, timezone, trigger, start and completion times.
- Per-category outcomes.
- Imported, updated, skipped, warning, and redacted error counts.
- App and adapter versions when available.

The record does not contain raw HealthKit samples, workout routes, locations, health values, or stack traces. Category failures are independent. The consumer Today response exposes only section-level freshness and safe unavailable/error states.

Current-day values become stale 30 minutes after their latest successful sync. This threshold is a named API policy and may be calibrated later. Manual refresh bypasses the five-minute mobile query cooldown.

## HealthKit Access And Privacy

The iOS adapter requests read-only access to:

- Active energy burned.
- Basal energy burned.
- Dietary energy consumed.
- Step count.
- Workouts.

Only rolling-window daily step aggregates and normalized workout summaries are transmitted. Today displays only the current local date; prior two dates are retained as reconciliation context. Routes, precise location, heart rate, and raw samples are not requested or transmitted. Technical bundle identifiers are not shown to users.

HealthKit does not reveal whether read access to an individual type was denied. Empty results therefore use neutral states such as `No step data found today` or `No workouts logged today`.

## Consequences

- `GET /v1/me/today` exposes independent burn, intake, step, and workout states without forecast fields.
- Hiding a card does not disable ingestion or delete health data.
- Current-day awareness never creates ledger transactions, changes Available Bank, changes Planned Treat progress, or alters the latest completed contribution. The latest contribution card may display ADR 009 provisional/locked status and correction context.
- Background HealthKit delivery, historical activity charts, workout analytics, and dashboard reordering remain deferred. Rolling-window workout snapshots replace removed provider workouts for that provider/date but remain banking-neutral.

## Rejected Alternatives

### Add step or workout calories to burned calories

Rejected because Apple Health active energy already includes qualifying workout energy and steps are not an independent calorie source. Adding either would double count expenditure.

### Let users hide Available Bank

Rejected because CalorieBank is bank-first and Available Bank is the product's primary value.

### Drag-and-drop ordering now

Rejected because fixed ordering plus visibility toggles tests the customization need with substantially less product and implementation complexity.

### Store raw HealthKit workouts

Rejected because normalized summaries are sufficient for Today and materially reduce sensitive-data collection.

## References

- ADR 005: future Activity Opportunity notifications.
- ADR 006: provider-neutral ingestion.
- ADR 007: Apple Health device ingestion and development-build boundary.
- Apple: [Step count](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/stepcount).
- Apple: [HKWorkout](https://developer.apple.com/documentation/healthkit/hkworkout).
