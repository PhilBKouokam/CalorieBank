# ADR 006: Provider-Neutral Ingestion Architecture

Date: 2026-07-21

## Status

Accepted.

## Context

CalorieBank needs source-attributed intake and total-expenditure data before it can support the automatic V1 banking loop. The first implementation must not couple bank calculations, ledger logic, Planned Treat progress, or Today awareness to Apple Health, Fitbit, MyFitnessPal, Cronometer, Garmin, WHOOP, or any other concrete provider.

The product also needs a live `Today so far` awareness model that shows adjusted burned calories and eaten calories without projecting the bank or mutating finalized balances.

## Decision

CalorieBank will use provider-neutral ingestion interfaces and normalized aggregate models.

The domain defines abstractions:

- `ExpenditureProvider`
- `IntakeProvider`
- `StepProvider`
- `WorkoutProvider`

Provider adapters convert provider-specific payloads into normalized daily aggregate models before the rest of CalorieBank sees the data. The ingestion domain must not switch on provider names. Adding a provider should require implementing the provider interface and registering the adapter.

Concrete provider adapters depend on the domain abstractions. Domain logic does not depend on concrete providers.

## Normalized Aggregates

Daily expenditure aggregates preserve:

- User ID.
- Local date.
- Timezone.
- Stable provider identifier, with consumer display labels resolved separately.
- Provider record ID.
- Raw total daily expenditure.
- Adjusted daily expenditure.
- Adjustment factor.
- Imported time.
- Provider-updated time.
- Sync status.
- Current-day flag.

Daily intake aggregates preserve:

- User ID.
- Local date.
- Timezone.
- Provider display name.
- Provider record ID.
- Total calories consumed.
- Imported time.
- Provider-updated time.
- Sync status.
- Current-day flag.

CalorieBank stores daily aggregates only. It does not store external food entries as its own food log.

Daily step aggregates preserve cumulative provider totals using the same user, local-date, timezone, provider, update-time, status, and idempotency concepts. Normalized workouts preserve stable provider workout identity, restrained activity taxonomy, display name, start/end, duration, optional energy/distance context, and sync provenance. Raw HealthKit workout objects, routes, locations, and heart-rate samples do not enter the domain or API.

## Expenditure Adjustment

The current V1 adjustment factor remains configurable from the shared domain constant:

```text
adjusted_daily_expenditure =
  raw_total_daily_expenditure * 0.80
```

The raw and adjusted values are both stored. Completed-day ledger values remain immutable. ADR 009 implements reconciliation for provisional days: changed provider aggregates create immutable calculation versions and compensating delta transactions rather than destructive ledger overwrites. ADR 010 supplies those aggregates through the provider-neutral rolling three-day sync without changing these interfaces.

## Today So Far Read Model

`GET /v1/me/today` exposes current-day awareness only.

It may include:

- Date.
- Timezone.
- Adjusted burned calories.
- Raw burned calories.
- Burn adjustment factor.
- Burn source.
- Burn last synced time.
- Calories eaten.
- Intake source.
- Intake last synced time.
- Freshness/status fields.
- Current-day flag.
- Cumulative steps and independent freshness.
- Normalized logged workouts and independent freshness.

It must never include projected bank change, projected deficit, projected withdrawal, calories remaining, or any value that appears official before day finalization.

Today values are not ledger inputs. After the local day completes, the provisional pipeline may consume source-attributed expenditure and intake aggregates under the approved bank-calculation rules; steps and workouts remain excluded.

## Concrete Adapters

Apple Health is the first real adapter. Its device-local implementation and sync boundary are governed by ADR 007. The domain interfaces and normalized aggregate model remain unchanged by that provider choice.

## Development Providers

The first implementation registers deterministic development adapters:

- `DevelopmentExpenditureProvider`
- `DevelopmentIntakeProvider`

They implement the same interfaces future providers will implement. They return:

- Raw expenditure: `2,000 kcal`.
- Adjusted expenditure: `1,600 kcal`.
- Intake: `1,500 kcal`.
- Provider display name: `Development Provider`.

These adapters exist only to exercise the architecture. They are not production integrations and are enabled only through an explicit ingestion mode. Device and production modes must not return synthetic aggregates.

## Rejected Alternatives

### Provider-Specific Domain Logic

Rejected because provider JSON and field names would leak into bank logic and make future provider replacement risky.

### Switching On Provider Names

Rejected because it violates dependency inversion and forces business logic changes for every new provider.

### GET Endpoint Writes

Rejected because `GET /v1/me/today` must remain read-only. Development bootstrap or future sync jobs may write normalized aggregates; the read endpoint must not.

### Current-Day Forecast

Rejected because Today so far is awareness only. Current-day data is incomplete and must not look like an official bank result.

## Consequences

- Future providers must implement `ExpenditureProvider` or `IntakeProvider`.
- Activity-context providers implement `StepProvider` or `WorkoutProvider`; their values never alter expenditure or ledger calculations.
- Normalization happens inside adapters before data reaches ingestion services.
- The ledger, finalized bank history, Planned Treat, and Activity Opportunity Engine remain provider-neutral.
- Reconciliation remains separate from ingestion and is not implemented by this ADR.
- Apple Health is the first device adapter; development providers remain test and explicit-local-fallback tools.
