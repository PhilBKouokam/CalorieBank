# ADR 021: Personalized Step Contribution and Initial Dashboard Visibility

## Status

Accepted for V1 A1 and A2.2.

## Decision

Steps remain activity context and never become an accounting input. Today may show an estimated step contribution as soon as CalorieBank has one completed walking or running workout from the authoritative activity provider with both provider-reported workout steps and active calories. Calibration uses the latest five qualifying workouts available within a bounded 30-day lookback; one through five workouts are all valid. The weighted personal rate is:

`sum(walking workout calories) / sum(walking workout steps) * 1,000`

The estimate uses the unrounded pooled rate and rounds the displayed current contribution to 10 kcal. It never divides total daily expenditure by steps. Missing current steps or no valid calibration workout is `unavailable`; a real zero step count produces a ready zero estimate once calibration exists. Strength, cycling, swimming, rowing, and other unrelated workouts are excluded. Apple Health currently supplies no workout-step field through CalorieBank's adapter, so it remains unavailable until a semantically valid paired signal is implemented.

Google Health synchronization retains its banking rolling window and separately searches recent workout-only history backward for at most 30 days, stopping when five usable walk/run workouts are available. The estimate therefore can use pre-CalorieBank provider history and updates automatically as newer qualifying workouts replace older calibration records.

Workout cards may display provider-reported workout calories and a rounded `workout calories × 0.8` estimated-actual-burn value. This is explanatory presentation only. It is not stored as another expenditure aggregate and is never added to daily total expenditure.

The estimate is explanatory only. It never changes raw or adjusted expenditure, Opening Bank, Available Bank, Recovery, Planned Treat, finalization, reconciliation, correction transactions, or the ledger.

A2.2 uses this same pooled personal rate in two advisory directions. For a total-step target, it starts from A2.1's projected provider burn if the user rests for the remainder of the day and adds only `max(0, targetSteps - currentSteps) * providerCaloriesPerStep`. The displayed estimated-actual total applies `0.80` after the provider-level projection. For a desired estimated-actual burn, it first converts that input to provider burn with `desiredActualBurn / 0.80`, subtracts the same resting-day baseline, divides only the positive remainder by the personal provider calories-per-step rate, and adds those steps to the current count. Inputs are transient, calorie estimates round to 10 kcal, and step results round to 100 steps. Neither direction writes health, provider, snapshot, ledger, or bank data.

For a new or previously unset preference, CalorieBank keeps Steps hidden while fewer than three completed authoritative step days exist. Once at least three valid days exist, it averages up to the seven most recent completed days. An average of at least 10,000 steps shows Steps; a lower average leaves it hidden. That inferred result is persisted once. A user toggle changes the preference source to `explicit`, and no future inference may override it. Existing preference rows are migrated as explicit.

## Consequences

- The estimate is personalized and can begin with one trustworthy calibration workout.
- Walking workout energy is not added to total expenditure; it explains a possible portion of an already authoritative total.
- The initial visibility decision is per user and per authoritative activity source. Provider records are not merged.
- Dashboard inference does not block onboarding or Opening Bank initialization.
- Detailed methodology UI, notifications, card reordering, historical provider switching, and broader adaptive disclosure remain deferred.

## Sources

- Google Health documents exercise `metricsSummary.caloriesKcal` as active workout calories and `metricsSummary.steps` as workout steps: <https://developers.google.com/health/data-types/workouts>
- Google Health documents daily steps as a reconciled count, separate from total calories: <https://developers.google.com/health/data-types/steps>
- Apple Health documents active energy as all physical activity and exercise energy, not walking-only energy: <https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/activeenergyburned>
