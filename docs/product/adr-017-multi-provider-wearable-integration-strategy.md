# ADR 017: Multi-Provider Wearable Integration Strategy

Status: Accepted 2026-08-17

V1 surface update 2026-08-18: Fitbit/Google Health and Apple Health are the user-facing wearable/activity connections. WHOOP and Garmin are deferred and are not exposed in the V1 mobile UI. This narrows product presentation without removing the capability registry, normalized contracts, dormant adapters, persistence, tests, or the provider investigation recorded here.

## Context

CalorieBank already resolves one authoritative provider for expenditure, activity context, and intake. Google Health/Fitbit is the first dedicated expenditure ecosystem and Apple Health is the first device-local ecosystem. The product must add wearable providers without weakening source provenance, inventing unsupported capabilities, or combining overlapping values.

Provider marketing terms such as calories, strain, activity energy, and workout energy are not interchangeable with total daily energy expenditure. A provider may feed banking only when its official contract exposes a semantically valid local-day total or enough non-overlapping components to derive one deterministically.

## Decision

Provider adapters continue to implement the provider-neutral `ExpenditureProvider`, `StepProvider`, `WorkoutProvider`, and `IntakeProvider` contracts. Provider identifiers and capability metadata are centralized. Banking and Today read models consume normalized records selected by role; they do not switch on provider payload fields.

Expenditure support is classified as:

- `FULL_TOTAL`: the provider supplies a documented total daily expenditure that includes resting and active energy.
- `DERIVABLE_TOTAL`: the provider supplies documented, non-overlapping components that CalorieBank can combine deterministically.
- `ACTIVE_ONLY`: the provider supplies only active or exercise energy and cannot feed banking.
- `UNAVAILABLE`: the available official contract does not establish a valid total.

Only `FULL_TOTAL` and reviewed `DERIVABLE_TOTAL` providers may be selected for expenditure. Exactly one authoritative provider is resolved for expenditure, activity context, and intake. Records from other providers may coexist for audit and later selection, but the main read model never sums steps, merges workout lists, or adds workout calories to total expenditure.

User selection is primary. Connecting a dedicated wearable does not silently replace an existing source. The product may recommend selecting the new provider, but selection requires explicit confirmation. Automatic fallback remains disabled initially. If a selected provider lacks data for a supported category, that category is unavailable unless the user has explicitly enabled a visibly attributed fallback.

## Verified capability matrix

The matrix records capabilities verified from current official public documentation and the narrower capabilities CalorieBank currently enables.

| Provider | V1 user-facing status | Expenditure class | Intake | Steps | Workouts | Workout context | Sleep | Heart rate | Push/webhook | Historical access | Authorization/access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google Health/Fitbit | Supported | `FULL_TOTAL` | Not enabled | Yes | Yes | Duration, type, optional energy/distance | Not enabled | Not enabled | Yes | Rolling API access | Google OAuth and restricted-scope approval |
| Garmin | Deferred | `UNAVAILABLE` pending approved calorie semantics | No | Documented | Documented | Activity details, subject to approved API contract | Documented | Documented | Push/ping | Backfill is documented | Garmin Connect Developer Program approval and OAuth 2.0 |
| WHOOP | Deferred | `UNAVAILABLE` | No | No verified steps capability | Yes | Duration, sport, workout kilojoules, distance, heart-rate summary | Yes | Workout/cycle summaries | Yes | Paginated cycles/workouts/sleep | WHOOP OAuth 2.0 and membership |
| Apple Health | Supported | `DERIVABLE_TOTAL` | Yes | Yes | Yes | Duration, type, optional energy/distance | Not enabled in V1 | Not enabled in V1 | Device observer delivery, not a server webhook | User-authorized device history | Native HealthKit authorization |

Capabilities marked documented for Garmin are not runtime-enabled until CalorieBank has approved-program access and has validated the exact response contract. A public reference to daily `calories` is not enough to prove that the value is total daily expenditure.

## Provider decisions

### Google Health/Fitbit

Google Health `total-calories` is a documented total including basal metabolism and active energy. It enters once as `rawTotalDailyExpenditure`; CalorieBank applies `0.80` once. Steps and exercise sessions are the selected activity context. Session energy is explanatory and is never added to Total Calories.

### Garmin

Garmin Health API publicly documents all-day calories, steps, heart rate, sleep, push/ping delivery, and backfill. Garmin Activity API documents activity summaries and detail files. The approved-program data dictionary that establishes the exact daily calorie semantics is not publicly available in the repository's current access state. Garmin is therefore registered as a known provider with expenditure `UNAVAILABLE`, and no production adapter claims successful access.

Once developer access is approved, implementation must verify whether the all-day calorie value includes basal and active energy, validate OAuth and push contracts against the approved documentation, and update the capability registry before enabling selection. Garmin program approval, brand requirements, and possible commercial licensing or minimum-device terms are launch dependencies, not architecture blockers.

### WHOOP

WHOOP v2 cycles are physiological cycles rather than user-local calendar days. Cycle and workout `kilojoule` values do not establish a documented local-day total daily expenditure. WHOOP is not an expenditure provider and cannot be selected for calorie burn.

WHOOP is implemented as a workout-context provider using `GET /developer/v2/activity/workout`, with `read:workout` and `offline` OAuth scopes. The adapter normalizes stable workout identity, activity name, start/end, duration, optional distance, and scored workout kilojoules converted to calorie context. These values never enter expenditure or the ledger. WHOOP does not have a verified steps capability, so selecting WHOOP for activity context intentionally leaves steps unavailable rather than silently using Apple Health.

### Apple Health

Apple Health remains first-class for all three roles. Expenditure is valid only when both cumulative Active Energy and Resting/Basal Energy are present for the same local-day window:

```text
rawTotalDailyExpenditure = activeEnergy + restingEnergy
adjustedDailyExpenditure = round(rawTotalDailyExpenditure * 0.80)
```

Active Energy alone is not a total. Apple Health also supports the current Dietary Energy, steps, and workout paths. HealthKit remains device-local and does not become a server OAuth provider.

## Connection and synchronization architecture

Server-accessible providers use server-owned OAuth state, token exchange, encrypted refresh-token persistence, refresh, revocation, and normalized API ingestion. Mobile starts authorization and displays safe connection state; provider secrets never enter JavaScript.

Device-local HealthKit remains on iOS and uploads normalized aggregates. Every supported provider follows the rolling current-day, yesterday, and day-before-yesterday window. Each category and date succeeds independently. Current day remains awareness-only. Completed provisional days reconcile only when the selected authoritative expenditure or intake changes. Steps, workouts, sleep, and heart-rate context never invoke accounting.

Provider push systems should eventually signal narrowly scoped fetch and reconciliation work. Garmin push/ping and WHOOP webhooks are preferred over aggressive polling once hosted background execution is approved. Webhook payload authentication, deduplication, event ordering, retries, and provider fetches remain separate from accounting. Background workers are deferred.

## Provider onboarding process

Adding a provider requires:

1. Audit current official documentation, approval, licensing, privacy, and retention obligations.
2. Classify expenditure semantics and verify each capability independently.
3. Implement only the provider-neutral contracts supported by evidence.
4. Normalize stable identifiers, local-day/timezone provenance, timestamps, and source metadata.
5. Register consumer labels and selectable roles centrally.
6. Test no-summation, stale updates, idempotency, partial failure, and ledger isolation.
7. Require explicit user selection before changing an authoritative source.

## Privacy and operational constraints

- Request the minimum scopes needed for enabled capabilities.
- Do not log tokens or raw health payloads.
- Encrypt server-side refresh tokens and preserve revocation state.
- Retain only normalized records required for the product and audit trail.
- Treat provider approval, licensing, rate limits, and attribution requirements as release gates.
- Do not advertise a connection until the runtime path can be exercised with real provider access.

## Consequences

- Fitbit and Apple Health remain user-facing V1 providers under existing selection rules.
- WHOOP's workout-context implementation is retained as dormant future architecture but is not a supported V1 connection.
- Garmin has a stable registry and persistence boundary but is deferred from V1 pending program access and calorie-semantic verification.
- Future Oura, Samsung, Health Connect, and other providers must pass the same capability audit; brand popularity does not establish banking eligibility.
- Provider switches during a provisional window may create append-only correction deltas only when expenditure or intake changes. Locked days remain unchanged.

## Rejected alternatives

- **Treat every calorie field as total expenditure:** workout and active calories omit resting energy or overlap provider totals.
- **Merge all connected ecosystems:** duplicates steps, sessions, and energy while erasing provenance.
- **Hardcode a global provider ranking:** overrides user intent and cannot account for capability gaps.
- **Enable Garmin from public marketing descriptions:** approval-only semantics and licensing obligations remain unverified.
- **Use WHOOP cycle or workout energy as a daily total:** WHOOP cycles are not local calendar-day total-expenditure records.
- **Silently use Apple Health when a selected source fails:** changes provenance without user awareness.

## Official references reviewed

- Garmin Connect Developer Program: [Health API](https://developer.garmin.com/gc-developer-program/health-api/), [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/), [program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/), and [API brand guidelines](https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf).
- WHOOP Developer Platform: [API overview](https://developer.whoop.com/docs/developing/overview/), [OAuth](https://developer.whoop.com/docs/developing/oauth/), [cycles](https://developer.whoop.com/docs/developing/user-data/cycle/), [webhooks](https://developer.whoop.com/docs/developing/webhooks/), and [rate limits](https://developer.whoop.com/docs/developing/rate-limiting/).
- Apple HealthKit: [framework overview](https://developer.apple.com/documentation/healthkit), [authorization](https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data), [workouts](https://developer.apple.com/documentation/healthkit/hkworkout), [observer queries](https://developer.apple.com/documentation/healthkit/executing-observer-queries), and [privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy).
- Google Health API v4: Total Calories, Steps, Exercise, OAuth, and webhook documentation as recorded in ADR 016.
