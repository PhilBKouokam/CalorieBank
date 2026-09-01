# ADR 016: Authoritative Provider Selection and Multi-Provider Data Resolution

Status: Accepted; Google Health transport amendment accepted 2026-08-14

> ADR 017 extends this selection model to additional wearable ecosystems. It does not change the one-authoritative-source or no-summation decisions in this ADR.

> ADR 018 applies the same one-authoritative-source rule to direct nutrition providers. FatSecret and Apple Health intake may coexist but never contribute to the same calculation together.

## Context

Physical-device QA confirmed that Apple Health is useful for Dietary Energy, steps, and workouts, but its expenditure composition is not interchangeable with Fitbit-derived total daily expenditure. Multiple providers may describe overlapping energy, so choosing the most recently updated record or adding provider totals would make banking nondeterministic and can double-count expenditure.

The legacy Fitbit Web API is scheduled to shut down in September 2026. It must not become CalorieBank's production expenditure transport.

## Decision

CalorieBank may connect multiple providers, but exactly one provider is authoritative for each banking input or activity-context category for a user and calculation date:

- Expenditure uses the explicitly selected dedicated expenditure provider when connected and valid. Fitbit-derived data delivered by Google Health API v4 is the first supported dedicated expenditure provider.
- Intake uses the explicitly selected intake provider. Apple Health Dietary Energy remains the V1 intake path, including nutrition data written to HealthKit by products such as Cronometer.
- Apple Health expenditure is an explicit fallback only. It is valid only when both cumulative Active Energy and Resting/Basal Energy are available; the raw fallback total is their integer sum.
- Automatic fallback is disabled initially. Missing selected-provider data produces `waiting_for_expenditure` or an unavailable Today state rather than a hidden source switch.
- Connection and role selection are distinct. Multiple providers may remain connected while one source is selected for Calories Burned and one for Calories Eaten. For private beta, selecting Calories Burned changes expenditure and activity context together; intake changes independently.
- Disconnecting a source selected for its role is rejected until the user explicitly chooses another valid source. Credential loss produces a selected-but-unavailable state and never silently changes authority. Disconnecting an unselected provider preserves normalized historical aggregates, provenance, snapshots, ledger records, and date-specific historical authority.
- Apple Health authorization remains controlled by iOS. Server-side historical Apple Health data is not proof of current device permission. The role read model marks Apple Health as device-managed so mobile can compose local HealthKit availability without exposing writer identifiers.
- Global role changes reconcile provisional completed days through the existing append-only path. Explicit historical day authority continues to outrank global selection for its exact date and role.
- Provider selection has three roles: expenditure, activity context, and intake. Selecting a dedicated expenditure provider also selects it for activity context when its verified capability record supports steps and workouts.
- Google Health/Fitbit supports expenditure, daily steps, exercise sessions, session duration and classification, and optional workout calories/distance. Apple Health remains the intake source. It remains available for activity context for users without Fitbit and as an explicit, visibly attributed fallback only when fallback policy is enabled.
- Exactly one step provider and one workout provider are resolved for consumer views. Fitbit and Apple Health steps are never summed, and their workout lists are never merged.
- Steps and workouts never enter expenditure or the ledger separately. Workout calories explain activity only and are not added to Google Health Total Calories.

Google Health's `total-calories` daily rollup enters once as raw total daily expenditure. Google defines Total Calories as total energy expenditure including basal metabolism and active energy. CalorieBank then applies the centralized `v1-total-expenditure-80` policy exactly once. Active energy, BMR, steps, and workout calories are not added to that total.

Provider records coexist by user, local date, provider, and aggregate type. The stable internal provider identifier for this transport is `google_health_fitbit`; consumer UI uses `Fitbit`. A provider-selection record chooses the authoritative expenditure and intake records. Domain resolution depends on provider-neutral identifiers and never switches on Google Health or Fitbit payload fields.

## OAuth and transport

Google Health is server-accessible, unlike HealthKit. Mobile starts Google authorization using the system browser. The API owns OAuth state, PKCE verifier handling, authorization-code exchange, encrypted token persistence, refresh-token rotation, Google Health API calls, and normalized aggregate persistence. Client secrets and refresh tokens never enter mobile JavaScript or logs.

The API requests only `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`. OAuth attempts expire, are single-use, and bind a hashed state value to the development user and an allowlisted mobile callback. Production deployments must provide a managed 32-byte encryption key and HTTPS callback URL through secret management.

The API requests each of the current day, yesterday, and the day before independently. Total expenditure uses `POST /v4/users/me/dataTypes/total-calories/dataPoints:dailyRollUp`; steps use the equivalent `steps` daily rollup; workouts use the paginated `GET /v4/users/me/dataTypes/exercise/dataPoints` session list constrained to one civil day. Missing values remain unavailable and are never normalized as zero. Category failures remain independent.

Provider capabilities are registered centrally. The current verified matrix is:

| Provider | Expenditure | Intake | Steps | Workouts | Workout energy |
| --- | --- | --- | --- | --- | --- |
| Google Health/Fitbit | Yes | No | Yes | Yes | Optional when supplied |
| Apple Health | Explicit fallback | Yes | Yes | Yes | Optional context |

Sleep and heart-rate capabilities are not enabled by this decision.

## Today and completed-day accounting

Today resolves each category independently. With Fitbit selected, Burned, Steps, and Workouts use Google Health/Fitbit while Eaten uses Apple Health. Provider totals and activity records are never summed or merged. A temporary Fitbit activity failure remains visibly unavailable; Apple Health is not substituted silently. Current-day values remain awareness-only.

Every calculation snapshot preserves authoritative expenditure and intake provider identifiers and source record identifiers. A selection change may recalculate a `PROVISIONAL` day and append an immutable correction delta. It does not edit prior transactions or snapshots. `LOCKED` days never change automatically after a provider connection or selection change.

Existing locked QA history is retained. The read-only development provenance report identifies its source and whether an Apple Health aggregate included both energy components. Any locked correction remains a future administrative-reconciliation concern.

## Migration decision

The pre-launch legacy Fitbit transport, OAuth endpoints, `summary.caloriesOut` parser, and Fitbit-specific token tables are removed or renamed before Fitbit physical-device QA. New OAuth connections and aggregates use Google Health API v4 and `google_health_fitbit`. Existing immutable aggregate, snapshot, report, and ledger provenance is not rewritten.

## Consequences

- Users can see which provider controls calorie burn and change it intentionally.
- Missing Fitbit data is visible rather than silently replaced by Apple Health.
- Apple Health remains independently useful for intake and activity context.
- A dedicated provider can own expenditure and related activity context without changing provider-neutral domain interfaces.
- The database can retain overlapping provider records for audit without adding them together.
- Connecting future expenditure or intake providers requires an adapter, registration, and an allowed selection value; banking formulas remain unchanged.
- OAuth revocation and refresh failure produce a reconnect state. They never trigger fake data or provider summation.
- Google Health restricted-scope verification and security review are launch requirements; test-mode refresh tokens expire after seven days and test access is limited to allowlisted accounts.

## Rejected alternatives

- **Keep legacy Fitbit as a second production path:** creates migration ambiguity immediately before API shutdown.
- **Latest provider update wins:** nondeterministic and obscures provenance.
- **Sum Fitbit and Apple Health:** double-counts overlapping expenditure.
- **Rebuild Total Calories from components:** duplicates a Google-derived total that already includes basal and active energy.
- **Use Apple Health Active Energy alone:** omits resting expenditure and is not total daily expenditure.
- **Always fall back silently:** can change banking inputs without informed user selection.
- **Combine activity context across providers:** duplicates steps and sessions and obscures which ecosystem is authoritative.
- **Rewrite locked QA days:** violates immutable locked-history policy.
