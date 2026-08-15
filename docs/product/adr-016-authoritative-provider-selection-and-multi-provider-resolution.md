# ADR 016: Authoritative Provider Selection and Multi-Provider Data Resolution

Status: Accepted

## Context

Physical-device QA confirmed that Apple Health is useful for Dietary Energy, steps, and workouts, but its expenditure composition is not interchangeable with Fitbit's documented daily calories-burned total. Multiple providers may describe overlapping energy, so choosing the most recently updated record or adding provider totals would make banking nondeterministic and can double-count expenditure.

## Decision

CalorieBank may connect multiple providers, but exactly one provider is authoritative for each banking input for a user and calculation date:

- Expenditure uses the explicitly selected dedicated expenditure provider when connected and valid. Fitbit is the first supported dedicated expenditure provider.
- Intake uses the explicitly selected intake provider. Apple Health Dietary Energy remains the V1 intake path, including nutrition data written to HealthKit by products such as Cronometer.
- Apple Health expenditure is an explicit fallback only. It is valid only when both cumulative Active Energy and Resting/Basal Energy are available; the raw fallback total is their integer sum.
- Automatic fallback is disabled initially. Missing selected-provider data produces `waiting_for_expenditure` or an unavailable Today state rather than a hidden source switch.
- Steps and workouts remain Apple Health context. They never enter expenditure or the ledger separately.

Fitbit's daily activity `summary.caloriesOut` enters once as raw total daily expenditure. CalorieBank then applies the centralized `v1-total-expenditure-80` policy exactly once. Fitbit steps, activity calories, workout calories, and BMR are not added to that total.

Provider records coexist by user, local date, provider, and aggregate type. A provider-selection record chooses the authoritative expenditure and intake records. Domain resolution depends on provider-neutral identifiers and never switches on Fitbit payload fields.

## OAuth and transport

Fitbit is server-accessible, unlike HealthKit. Mobile starts authorization using the system browser. The API owns OAuth state, PKCE verifier handling, authorization-code exchange, encrypted token persistence, refresh-token rotation, Fitbit API calls, and normalized aggregate persistence. Client secrets and refresh tokens never enter mobile JavaScript or logs.

The API requests only Fitbit's `activity` scope for this milestone. OAuth attempts expire, are single-use, and bind a hashed state value to the development user and an allowlisted mobile callback. Production deployments must provide a managed 32-byte encryption key and HTTPS callback URL through secret management.

## Today and completed-day accounting

Today resolves each category independently. With Fitbit selected, Burned uses Fitbit, Eaten uses Apple Health, and steps/workouts use Apple Health. Provider totals are never summed. Current-day values remain awareness-only.

Every calculation snapshot preserves authoritative expenditure and intake provider identifiers and source record identifiers. A selection change may recalculate a `PROVISIONAL` day and append an immutable correction delta. It does not edit prior transactions or snapshots. `LOCKED` days never change automatically after a provider connection or selection change.

Existing locked QA history is retained. The read-only development provenance report identifies its source and whether an Apple Health aggregate included both energy components. Any locked correction remains a future administrative-reconciliation concern.

## Consequences

- Users can see which provider controls calorie burn and change it intentionally.
- Missing Fitbit data is visible rather than silently replaced by Apple Health.
- Apple Health remains independently useful for intake and activity context.
- The database can retain overlapping provider records for audit without adding them together.
- Connecting future expenditure or intake providers requires an adapter, registration, and an allowed selection value; banking formulas remain unchanged.
- OAuth revocation and refresh failure produce a reconnect state. They never trigger fake data or provider summation.
- Fitbit's documentation announces legacy Web API deprecation in September 2026. The current adapter is suitable for development validation, but production Fitbit launch requires the documented Google Health API migration. This transport risk does not change authoritative-provider or normalized-aggregate policy.

## Rejected alternatives

- **Latest provider update wins:** nondeterministic and obscures provenance.
- **Sum Fitbit and Apple Health:** double-counts overlapping expenditure.
- **Use Apple Health Active Energy alone:** omits resting expenditure and is not total daily expenditure.
- **Always fall back silently:** can change banking inputs without informed user selection.
- **Rewrite locked QA days:** violates immutable locked-history policy.
