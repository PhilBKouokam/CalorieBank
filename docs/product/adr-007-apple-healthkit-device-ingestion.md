# ADR 007: Apple HealthKit as the First Device Ingestion Adapter

> **ADR 016 refinement:** Apple Health remains the intake hub and an explicit expenditure/activity fallback. When Fitbit is selected, its verified Google Health capabilities become authoritative for expenditure, steps, and workouts. Apple Health expenditure is valid only when both Active and Resting/Basal Energy are present; Active Energy alone must not be uploaded as total expenditure.

Date: 2026-07-21

## Status

Accepted and implemented for foreground device ingestion; ADR 010 extends queries to the rolling three-day window. Physical-device authorization and real-data QA remain required.

## Context

CalorieBank needs one technically credible iPhone ingestion path without coupling the bank domain to a provider. HealthKit can expose active energy, basal energy, and dietary energy that other authorized applications have written, but its store is device-local and unavailable to the API server. HealthKit native code is also unavailable in Expo Go.

## Decision

CalorieBank uses `@kingstinct/react-native-healthkit` in an Expo development build. The mobile integration provides focused expenditure, intake, step, and workout adapters behind the provider-neutral interfaces from ADR 006. HealthKit identifiers and query structures stay in the mobile adapter.

Dietary Energy additionally follows ADR 022: the device filters to one selected writer source before normalization. An all-writer cumulative statistic is diagnostic-only and must never feed authoritative intake.

The device queries the current local calendar day, normalizes cumulative aggregates, and sends validated commands to:

- `POST /v1/me/ingestion/expenditure`
- `POST /v1/me/ingestion/intake`
- `POST /v1/me/ingestion/steps`
- `POST /v1/me/ingestion/workouts`

A coordinated mobile sync creates and completes a lightweight server sync session around these independently retryable commands.

The commands do not accept `userId`, adjusted expenditure, an adjustment factor, or ledger fields. The API resolves the current development user and applies the centralized `v1-total-expenditure-80` policy. `GET /v1/me/today` remains read-only.

## HealthKit Access

The app requests read access only to:

- Active energy burned.
- Basal energy burned.
- Dietary energy consumed.
- Step count.
- Workouts.

The HealthKit capability and read-purpose string are generated from source-controlled Expo configuration. Background delivery is disabled. No HealthKit write purpose or write permission is requested.

HealthKit does not disclose whether read access to a type was denied. An empty query can mean denial, limited access, or no matching samples. Consumer states therefore use `No data found today`, `Waiting for data`, or `Health data unavailable`; they do not infer permission denial.

The local connection state records that HealthKit was available and the authorization request completed. It is intentionally separate from per-category data availability and synchronization health. Empty dietary energy, steps, or workouts do not disconnect Apple Health, and one category failure does not suppress successful categories. A real query or upload failure may produce `Connected · Sync issue`; an otherwise successful sync with empty or independently unavailable categories may produce `Connected · Some data unavailable`. Development builds expose only safe category, date-boundary, aggregate, and upload diagnostics, never individual HealthKit samples.

## Expenditure Composition

The adapter deterministically rounds active and basal cumulative values to integer kilocalories, then calculates:

```text
raw_total_daily_expenditure = active_energy + basal_energy
adjusted_daily_expenditure = raw_total_daily_expenditure * 0.80
```

The API verifies active-plus-basal consistency when component metadata is supplied and applies `0.80` exactly once. Workout or Move calories are not added separately.

For the open current day, these are cumulative values found within the local-day query window. This adapter does not provide an approved estimate of resting or total expenditure for the unelapsed part of the day and does not establish a full-day expenditure forecast. ADR 012 therefore treats Apple Health's current values as confirmed expenditure so far, not a complete Today's Eating Budget.

Step count is a cumulative context metric and is not converted into calories. Logged workout energy is descriptive and already represented within active energy. It is never added to raw expenditure, adjusted expenditure, or the ledger.

## Intake

The adapter reads cumulative dietary energy only. CalorieBank does not import individual foods or claim a specific food-tracking source unless reliable source metadata exists. V1 consumer copy uses `Imported from Apple Health`. Missing dietary energy does not suppress valid expenditure.

## Identity, Idempotency, And Time

The stable provider identifier is `apple_health`; `Apple Health` is only its consumer display label. The API derives deterministic daily aggregate identities from provider, aggregate type, and local date. Database uniqueness also enforces one aggregate per user, local date, and provider for each aggregate type.

Newer cumulative totals replace prior open-day totals. Equal snapshots are idempotent, and snapshots with an older `providerUpdatedAt` are ignored. Cumulative snapshots are never summed.

The device calculates local calendar boundaries, including daylight-saving transitions, and sends both `localDate` and an IANA timezone. ADR 010 extends the same adapter to current day, yesterday, and the day before. A travel-timezone change creates a new local-date context; existing finalized reports retain their captured timezone.

## Development Provider Policy

Synthetic providers are controlled by `TODAY_INGESTION_MODE`. Device and production modes do not return synthetic aggregates. Development adapters remain available for tests and explicit local fallback only. The system must never silently replace unavailable Apple Health data with fake values.

## Privacy And Security

- Only normalized daily calorie/step aggregates, optional active/basal totals, and normalized workout summaries are transmitted.
- Individual HealthKit samples are not transmitted or stored.
- Workout routes, precise location, heart-rate samples, and technical source bundle identifiers are not transmitted.
- Health payloads are not logged or placed in URLs.
- Sync commands reject client-supplied user IDs and resolve ownership server-side.
- Users manage system Health authorization in iOS Settings or the Health app. CalorieBank's disconnect action only disables its local refresh state and must say so.
- Health aggregate retention, export, and deletion must follow the broader user-data deletion policy before beta.

## Consequences

- A native rebuild is required after changing HealthKit capabilities, purpose strings, or native dependencies.
- Expo Go cannot run this integration; normal JavaScript iteration uses the installed development client.
- App-launch, foreground, screen-focus, connection, and manual refresh use a rolling three-day query with a cooldown. Background delivery is deferred.
- Current-day HealthKit aggregates never create ledger transactions, modify Available Bank, alter Planned Treat progress, finalize a day, or produce a bank forecast.
- Current-day HealthKit aggregates cannot by themselves produce a numeric Today's Eating Budget until the remaining-expenditure and goal-mapping decisions in ADR 012 are approved.
- Provisional-day reconciliation after provider corrections is implemented by ADR 009. ADR 010 supplies the prior two local dates and invokes orchestration after upload. History beyond that window and background delivery remain deferred.

## References

- Apple: [Authorizing access to health data](https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data).
- Apple: [Configuring HealthKit access](https://developer.apple.com/documentation/Xcode/configuring-healthkit-access).
- Expo: [Introduction to development builds](https://docs.expo.dev/develop/development-builds/introduction/).
- Expo: [Add custom native code](https://docs.expo.dev/workflow/customizing/).
- ADR 006: provider-neutral ingestion architecture.
