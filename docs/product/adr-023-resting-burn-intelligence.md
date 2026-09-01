# ADR 023: Resting Burn Intelligence

## Status

Accepted for V1 A2.1.

## Decision

Prediction-only CalorieBank features use available pre-signup wearable history whenever possible. `insufficient_data` is reserved for a connected source that genuinely lacks defensible historical resting evidence; account age is never an eligibility condition.

The persisted model contains only provider, provider kcal/hour, evidence type, observation count, lookback dates, and calculation time. Raw HealthKit samples and Google Health hourly observations are not persisted.

Persistence is a cache, not a display prerequisite. `GET /v1/me/today` first uses a valid cached model; when the authoritative source is Fitbit and the model is missing or stale, it performs the bounded prediction-only historical read, stores only the derived cache, and returns the resulting forecast in that same request. This operation creates no ingestion session, provider aggregate, bank snapshot, reconciliation, or ledger transaction.

Source hierarchy:

1. Explicit provider resting/basal energy.
2. Historical low-activity hourly total expenditure with at most 100 steps and no workout overlap.
3. Historical daily basal energy converted using the actual 23/24/25-hour local-day duration.
4. `insufficient_data`.

Apple Health uses `HKQuantityTypeIdentifierBasalEnergyBurned` daily statistics collections. Google Health uses official one-hour `total-calories` and `steps` rollups and excludes workout-overlap hours. The Google estimate is the median qualifying hourly calories so isolated high values do not dominate it.

Both providers try 14 completed days first, then 30, then 90 only when evidence remains sparse. Google accepts three qualifying low-activity hours; this is prediction-only context, so several credible observations are preferable to suppressing a useful estimate. Apple accepts the first window containing at least one valid completed basal-energy day.

For prediction-only features, CalorieBank must use available pre-signup wearable history and should return a useful estimate whenever defensible historical evidence exists. `insufficient_data` is a last-resort state, not the default result of conservative thresholds. Google hourly `total-calories` rollups intentionally omit an explicit `pageSize`: physical API validation showed that the service rejects that optional field for this data type even while accepting the otherwise identical bounded rollup.

Current-day Google Health `total-calories` and Apple Health Active plus Basal Energy are accumulated observations, not CalorieBank full-day forecasts. Therefore:

```text
projectedProviderBurn =
  currentProviderBurn + providerRestKcalPerHour * remainingLocalDayHours

projectedAdjustedBurn = projectedProviderBurn * 0.80
```

The local-day remainder uses timezone-aware civil-day boundaries and supports DST-short and DST-long days. The forecast is advisory and cannot change Available Bank, Recovery, Opening Bank, provider authority, snapshots, finalization, reconciliation, or the ledger.

`Why 80%?` appears as lightweight contextual UI where the multiplier is first encountered on Today. It explicitly identifies CalorieBank's founder, describes his cut and the ChatGPT suggestion that led him to try the `0.8` multiplier, does not claim universal wearable error or guaranteed weight loss, and must not navigate away from Today or appear again in Today Detail.
