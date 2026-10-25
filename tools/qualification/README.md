# Isolated fallback qualification service

This optional test entrypoint wraps the exact ec9cbef API and does not change the
production API, worker, application schemas or accounting. It is never imported
by either normal service entrypoint. Do not deploy the root production blueprint
to create this service.

Required configuration, with all credentials outside Git:

- Node20.20.2, `APP_ENV=local`, `AUTH_MODE=clerk`, matching existing `pk_test_` and
  `sk_test_` bindings. Production Clerk/provider keys fail startup.
- A separate database and role both named `caloriebank_test_phase5a`, with its exact
  hostname in `FALLBACK_TEST_DATABASE_HOST`. No production database/env group.
- `PUBLIC_INTAKE_MODE=without_fatsecret`, explicit
  `FATSECRET_PRIVATE_BETA_ACCOUNT_IDS` containing only synthetic internal UUIDs
  (or an explicit empty string to deny all). No timestamp cutoff is accepted by
  this Phase5B variant; remove the old timestamp variable from a test deployment.
  Actual private-beta membership belongs in a protected owner-reviewed file, never Git.
- `GOOGLE_HEALTH_LOCAL_AUTHORIZATION_PAUSED=1`, `CLERK_TELEMETRY_DISABLED=1`,
  `FALLBACK_TEST_SYNTHETIC_ONLY=1`, existing manual/authority capability flags1.
- Explicit `FALLBACK_TEST_EXPIRES_AT` within36 hours. After expiry requests fail
  closed. Renew only for an intentional test window.
- `FALLBACK_TEST_ALLOWED_SUBJECTS` is empty by default. At most two confirmed
  disposable **development-instance** users may be listed. The normal Clerk
  verification and deletion/provisioning identity boundary are preserved; the
  wrapper denies other subjects before ordinary provisioning.

Initial private test-hosting build:

```
npm ci --include=dev && npm run db:generate && npm run api:build
```

Start from repository root, with `FALLBACK_TEST_RUN_BASE_MIGRATIONS=1` only for this
new test database (guard accepts exactly40 existing core migrations):

```
node node_modules/tsx/dist/cli.mjs tools/qualification/fallback-test-server.ts
```

Default listener is loopback; only a reviewed isolated host sets
`FALLBACK_TEST_LISTEN_HOST=0.0.0.0`. Use the existing Render account, separate free
web service/database, explicit source branch, auto-deploy Off, private-only DB
networking and `/health/ready`. Never copy production environment groups, health
tokens, credentials, user data, snapshots or accounting into the test environment.

Provider authorization/callbacks, ingestion (including native health), deletion,
push registration/delivery and lifecycle routes are deliberately blocked. No
worker or prediction/finalization scheduler is installed. Real native-health
upload qualification therefore remains a separate gate requiring a reviewed
disposable data source and narrowly approved ingestion scope. Do not route founder
health data through this service. This limitation is explicit, not a passing test.

## Optional clean-device native-intake session (default off)

After confirming a personal-data-free physical device and obtaining explicit
Nutrition-read permission approval, the harness can admit only the exact
`POST /v1/me/ingestion/native-intake` route. Configure all four values together:
`FALLBACK_TEST_NATIVE_INTAKE=1`, `FALLBACK_TEST_NATIVE_SOURCE` (the approved writer
package), `FALLBACK_TEST_NATIVE_DATE` (the synthetic local date), and
`FALLBACK_TEST_NATIVE_CALORIES` (one positive integer, at most 10,000).

The normalized eight-day batch must contain exactly one usable total matching
that source, date and amount; all other days must have no total. Unexpected
amounts, sources, dates, extra health fields or additional usable days are rejected
before the ordinary API receives the upload. This is a test-data admission guard,
not proof of a record's origin: the clean-device confirmation and genuine native
read remain necessary. Normal authentication, two-subject admission, selection
revision, freshness and per-account persistence checks still apply. No scheduler,
provider credentials, activity/burn access, delivery or deletion is enabled.

Keep this mode off until its exact source/deployment and health-permission scope
are approved. Remove the four fixture variables after qualification or allow the
existing short session expiry to deny all requests. No new mobile build is
needed for this harness-only exception. A passing admission test is not physical
Health Connect qualification.

For cohort simulation, seed separately approved synthetic records under the two
confirmed test subjects: one explicitly listed internal UUID and one unlisted UUID;
preserve different IDs and exact selected authorities. Creation time and email
have no admission meaning. New signup never inherits a deleted UUID's membership.
Synthetic connected-source rows are simulations, not evidence of real provider
authorization or entitlement. Existing same-source/device/ledger qualification is
not replaced by them. Never alter production creation timestamps for eligibility.

A phone artifact must use this exact HTTPS host and the test publishable binding,
with no shared live tokens, no Budget/Reserve and Nutrition-only native permissions.
Do not replace or uninstall the qualified Play installation with an incompatible
APK. A separate test package requires its own signing/configuration review and
explicit permission approval before granting it health access. No native build or
physical qualification is implied by a healthy HTTP service or mocked/rendered tests.
