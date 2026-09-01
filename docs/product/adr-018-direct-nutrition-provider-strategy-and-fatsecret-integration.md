# ADR 018: Direct Nutrition Provider Strategy and FatSecret Integration

Status: Accepted 2026-08-18

Physical validation 2026-08-18: the delegated OAuth flow completed successfully on a physical iPhone development build, returned to CalorieBank, and displayed FatSecret as `Connected · Available` with intake selection available. This validates the development connection flow only; it is not a claim of production-scale reliability or broader account coverage.

## Context

CalorieBank is not a food logger. Users record food in their existing nutrition application, while CalorieBank imports one authoritative daily calorie-intake total. Apple Health Dietary Energy is the first intake path and remains an important bridge for compatible nutrition applications, but bridge availability depends on each application's HealthKit support and user configuration.

FatSecret is the first direct nutrition provider. Existing FatSecret members must connect the diary they already maintain. FatSecret OAuth 2.0 supports signed application requests only and cannot delegate access to an existing member's private profile. FatSecret's full three-legged OAuth 1.0 flow is the documented mechanism for that use case.

## Decision

Intake remains provider-neutral. `IntakeProvider` implementations expose normalized daily aggregate calories and capabilities; banking and Today never depend on provider payload fields. Initial providers are:

- `apple_health`: device-local bridge and first-class intake source.
- `fatsecret`: server-side direct delegated diary source.

Future identifiers such as `myfitnesspal`, `lose_it`, `cronometer_direct`, and `health_connect` are roadmap concepts only. They are not registered as connected capabilities or shown as functional controls until official access is verified.

Exactly one provider is authoritative for intake per user and calculation date. Apple Health and FatSecret records may coexist for provenance, but they are never summed. Changing the selected provider during a provisional window invokes the existing calculation service and may append an immutable correction delta. Locked history remains unchanged.

## FatSecret delegated authentication

CalorieBank implements FatSecret's official three-legged OAuth 1.0 flow:

1. The API signs a `POST` to `https://authentication.fatsecret.com/oauth/request_token` with HMAC-SHA1 and the configured callback.
2. The encrypted request-token secret and hashed request token are retained in a short-lived, single-use OAuth attempt.
3. Mobile opens `https://authentication.fatsecret.com/oauth/authorize?oauth_token=...` in the system authentication session.
4. FatSecret redirects to the API with the authorized request token and verifier.
5. The API signs a `GET` to `https://authentication.fatsecret.com/oauth/access_token` using the consumer secret and request-token secret.
6. The persistent delegated access token and token secret are encrypted separately and stored server-side.

OAuth 1.0 signing uses RFC 3986 encoding, lexicographically normalized request and OAuth parameters, HMAC-SHA1, unique nonces, and Unix timestamps. Token secrets, consumer secrets, signatures, and authorization values never enter mobile JavaScript or logs. OAuth 2.0 `client_credentials` is explicitly rejected for existing-user diary access.

## Diary read model

CalorieBank uses the read-only URL endpoint:

```text
GET https://platform.fatsecret.com/rest/food-entries/month/v1
```

This is FatSecret's `food_entries.get_month.v2` response contract. It returns summary nutrition totals for diary days in a nominated month and omits days with no entries. CalorieBank persists only:

- provider identifier
- local date and timezone
- integer total calories
- deterministic provider record identity
- import and sync provenance
- availability status

Individual foods, meals, macros, descriptions, and raw diary payloads are not persisted. A missing day is unavailable, not zero. An API error is also unavailable and never becomes zero.

FatSecret dates are civil-day integers counted from 1970-01-01. Conversion uses UTC arithmetic only to encode the date tuple; it does not interpret the value as a user instant. This prevents timezone and daylight-saving shifts. The imported aggregate retains the user's IANA timezone separately.

## Rolling synchronization and corrections

FatSecret sync covers current day, yesterday, and the day before yesterday. Distinct months are fetched once per run, so a month boundary may require two requests. Each requested date normalizes independently.

- Current day is awareness-only and cannot create a ledger transaction.
- Completed dates use the existing authoritative-input resolver and provisional reconciliation callback.
- Repeated equal values do not create calculation versions or ledger corrections.
- Edited provisional diary totals create only the calculated append-only delta.
- Omitted days are marked unavailable while prior normalized provenance is retained.
- Invalid/revoked delegated tokens move the connection to `needs_reconnect`; temporary API failures do not claim disconnection.

Disconnect deletes delegated credentials and outstanding OAuth attempts. Normalized historical aggregates, snapshots, reports, and ledger transactions remain. If FatSecret remains selected after disconnect, future completed days wait for intake until the user selects Apple Health or reconnects FatSecret; the product does not silently switch providers.

## Direct and bridge paths

The V1 intake model is:

```text
Direct: FatSecret -> CalorieBank

Bridge: compatible nutrition tracker -> Apple Health Dietary Energy -> CalorieBank
```

The Apple Health bridge is source-specific under ADR 022. One selected nutrition writer supplies the daily total; CalorieBank never sums Dietary Energy from multiple writers.

Cronometer and other products may support the bridge, but compatibility is controlled by those products and the user's Health permissions. CalorieBank must not claim every nutrition tracker writes Dietary Energy to Apple Health.

## Security and privacy

- Production callbacks and API traffic require TLS.
- Consumer and delegated secrets remain server-side.
- OAuth values are AES-256-GCM encrypted at rest with the external-provider encryption key.
- Request tokens expire after ten minutes and callbacks are single-use.
- FatSecret access is read-only; CalorieBank does not create or edit diary entries.
- Raw diary responses and individual foods are not logged or persisted.
- Disconnect deletes credentials without rewriting accounting history.
- Provider errors are mapped to restrained consumer states.

## Consequences

- Users can choose FatSecret or Apple Health for calories eaten.
- Today attributes Eaten to the selected source.
- Banking snapshots preserve the selected intake provider and provider-record identity.
- Direct providers can be added without changing calculation or ledger logic.
- Native iOS configuration is unchanged; FatSecret requires only API and JavaScript updates.

## Rejected alternatives

- **FatSecret OAuth 2.0 client credentials:** cannot delegate private existing-user profile access.
- **Create a separate FatSecret profile:** disconnects CalorieBank from the diary the user already maintains.
- **Import individual diary entries:** turns CalorieBank toward food logging and increases sensitive-data retention without banking value.
- **Treat omitted diary days as zero:** invents intake that FatSecret did not report.
- **Sum FatSecret and Apple Health:** can duplicate the same food and corrupt banking.
- **Silently switch intake providers on failure:** obscures provenance and can change provisional calculations unexpectedly.

## Official references

- [FatSecret authentication overview](https://platform.fatsecret.com/docs/guides/authentication)
- [FatSecret three-legged OAuth 1.0](https://platform.fatsecret.com/docs/guides/authentication/oauth1/three-legged)
- [FatSecret OAuth 1.0 signing](https://platform.fatsecret.com/docs/guides/authentication/oauth1)
- [FatSecret monthly food diary summary](https://platform.fatsecret.com/docs/v2/food_entries.get_month)
