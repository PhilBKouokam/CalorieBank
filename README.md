# CalorieBank

CalorieBank is moving from a web prototype into an iPhone-first mobile V1. The current source of truth is:

- `docs/architecture/current-state-audit.md`
- `docs/product/v1-prd.md`
- `docs/product/bank-calculation-spec.md`
- `docs/product/adr-001-connection-first-v1.md`
- `docs/product/adr-002-expenditure-relative-goal-adjustment.md`
- `docs/product/adr-003-interactive-summary-and-explanation.md`
- `docs/product/adr-004-automatic-bank-usage-and-dashboard-awareness.md`
- `docs/product/adr-005-personalized-activity-opportunity-notifications.md`
- `docs/product/adr-006-provider-neutral-ingestion-architecture.md`
- `docs/product/adr-007-apple-healthkit-device-ingestion.md`
- `docs/product/adr-008-activity-context-and-customizable-today.md`

## V1 Mission

CalorieBank V1 validates whether users can connect their existing health and calorie data, understand and trust an automatically updated calorie-bank balance, and use the morning bank update to plan enjoyable foods with less friction and guilt.

CalorieBank is not being built first as a replacement food logger. The first-user product is an automatic interpretation and planning layer over supported calorie-intake and calorie-expenditure data sources.

V1 includes a Planning Database for future meal and event estimates. It is not the food log. Connected calorie-tracking applications remain the source of truth for consumed intake and bank calculations.

## Repository Structure

```text
apps/
  mobile/          Expo React Native app with Expo Router and TypeScript
packages/
  domain/          Shared calorie-bank domain logic
  schemas/         Shared validation schemas and API DTOs
  config/          Shared TypeScript/tooling configuration
legacy/
  web-frontend/    Preserved Vite/React prototype
  mongo-api/       Preserved Express/Mongoose prototype
docs/              Product and architecture documentation
screenshots/       Existing prototype screenshots
```

## Current Foundation Scope

This branch includes the mobile/API foundation, foreground Apple Health rolling three-day ingestion, and the provisional bank pipeline. Current day remains awareness-only; yesterday and the day before are refreshed automatically so completed days can post immediately, remain correctable for two local calendar days, and then lock. Product direction no longer uses a user-entered absolute daily calorie target; V1 derives allowance from imported total daily expenditure, CalorieBank's `0.80` adjustment, and the user's goal-mode adjustment. Production authentication, background HealthKit delivery, notifications, and exact-midnight jobs remain deferred.

The first implementation milestones should prioritize connection-first onboarding, technically credible supported data-source sync, automatic bank calculation, transparent history, Planning Database estimates for future meals/events, and the morning bank update. Manual food logging is a fallback/correction path, not the dominant V1 loop. Bank-calculation behavior, including Available Bank, optional Emergency Bank, Recovery Forecast, and reserve-policy history, is governed by `docs/product/bank-calculation-spec.md`. Automatic bank usage and dashboard awareness are recorded in `docs/product/adr-004-automatic-bank-usage-and-dashboard-awareness.md`.

Future personalized Activity Opportunity Engine work is documented in `docs/product/adr-005-personalized-activity-opportunity-notifications.md`. It is intentionally deferred until real intake/expenditure ingestion, Today-so-far awareness, notification consent, stable Planned Treat timing, and explicit activity preferences exist. Estimated activity calories must never be deposited into the bank or treated as actual expenditure.

Provider-neutral ingestion is documented in `docs/product/adr-006-provider-neutral-ingestion-architecture.md`. Apple Health is the first real device adapter and is documented in `docs/product/adr-007-apple-healthkit-device-ingestion.md`. Current-day steps, workouts, sync-session observability, and dashboard visibility rules are documented in `docs/product/adr-008-activity-context-and-customizable-today.md`. Provisional posting and reconciliation are authoritative in `docs/product/adr-009-provisional-finalization-and-rolling-reconciliation.md`; reliable three-day historical sync and orchestration are governed by `docs/product/adr-010-reliable-historical-sync-and-finalization-orchestration.md`. Development adapters remain test-only or explicitly enabled local fallback; device and production modes must not silently return synthetic calories.

The user-facing Available Bank never displays below zero. Users may optionally reserve genuinely accumulated calories in an Emergency Bank for unexpected overages. The V1 protection sequence is Available Bank -> optional Emergency Bank -> Recovery Forecast, rather than making a large negative balance the primary focus.

## Requirements

- Node.js `20.20.2`
- npm
- Xcode and an Apple Developer signing identity for an iPhone development build
- An iPhone with Health enabled; HealthKit is not available in Expo Go

This repository pins Node with `.nvmrc` and `.node-version`. Use Node 20 for local development; Expo SDK 54 has failed in this project under Node 24 with `ERR_SOCKET_BAD_PORT`.

With nvm:

```bash
nvm install
nvm use
```

If nvm is not loaded in your shell:

```bash
source ~/.nvm/nvm.sh
nvm use
```

Confirm the active runtime before starting Expo:

```bash
node --version
npm --version
which node
```

## Install

From the repository root:

```bash
npm install
```

## Run API

The API requires PostgreSQL. Create local development and Prisma shadow databases named `caloriebank` and `caloriebank_shadow`, owned by the local `caloriebank` role. The shadow database lets `prisma migrate dev` validate migrations without granting the app role broad database-creation privileges.

Then copy the API environment template:

```bash
cp apps/api/.env.example apps/api/.env
```

Update `DATABASE_URL` and `SHADOW_DATABASE_URL` if your PostgreSQL username, password, host, port, or database names differ. The `DEV_USER_ID` and `DEV_USER_EMAIL` values identify one stable temporary development user until production authentication is implemented.

Generate the ORM client and run migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
```

From the repository root:

```bash
npm run api:dev
```

The API listens on port `3000` by default and exposes:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "caloriebank-api"
}
```

The goal-configuration endpoints are:

```text
GET /v1/me/goal-configuration
PUT /v1/me/goal-configuration
```

Example write payload:

```json
{
  "goalMode": "cut",
  "dailyEnergyAdjustment": -500,
  "adjustmentSource": "manual_calories"
}
```

Temporary development validation currently allows signed daily energy adjustments from `-2,000` to `2,000` kcal/day. This is an implementation boundary for early testing, not a final safety recommendation.

The read-only bank endpoints are:

```text
GET /v1/me/bank-summary
GET /v1/me/bank-history?range=D|W|M|3M|Y|ALL
GET /v1/me/bank-history/:logDate
```

The official bank is the all-time sum of immutable initial and correction ledger transactions. A completed day affects the bank immediately as provisional, can receive append-only correction deltas for two local calendar days, and then becomes locked. Range filters affect the history list and `rangeNetChangeCalories`; they do not replace the all-time bank.

The Planned Treat endpoints are:

```text
GET /v1/me/planned-treat
POST /v1/me/planned-treat
PATCH /v1/me/planned-treat
DELETE /v1/me/planned-treat
```

Example write payload:

```json
{
  "name": "Cookies and milk",
  "requiredCalories": 1500,
  "targetDate": null
}
```

Only one Planned Treat is active per user. Its progress is derived from the same all-time Available Bank returned by `GET /v1/me/bank-summary`; the Planned Treat table does not store or cache bank balance. Planned Treat is planning awareness only: it does not log food, deduct calories, or create ledger transactions. Actual consumption remains recorded in the user's calorie tracker and later affects the bank through imported total intake and completed-day finalization.

The Today-so-far awareness and device-ingestion endpoints are:

```text
GET /v1/me/today
POST /v1/me/ingestion/expenditure
POST /v1/me/ingestion/intake
POST /v1/me/ingestion/steps
POST /v1/me/ingestion/workouts
POST /v1/me/ingestion/sync-sessions
PATCH /v1/me/ingestion/sync-sessions/:sessionId
GET /v1/me/dashboard-preferences
PATCH /v1/me/dashboard-preferences
```

`GET /v1/me/today` returns current-day adjusted burned calories, calories eaten, cumulative steps, and normalized logged workouts with independent freshness states. It is read-only and must not project a bank change, mutate ledger rows, or change Available Bank. Step and workout calories are never added to active-plus-basal expenditure.

The ingestion commands are the device-to-server boundary for normalized daily summaries. They do not accept a user ID, adjusted expenditure, or bank effects. Each foreground sync independently queries and uploads current day, yesterday, and the day before. Current-day data remains awareness-only. Completed-date expenditure and intake updates invoke idempotent provisional posting or reconciliation; steps and workouts never do. The API applies the centralized `0.80` policy, replaces newer cumulative totals, and ignores stale updates. The device skips accepted unchanged values and retains failed uploads in an ordered local outbox. Coordinated sync sessions retain queried/uploaded/skipped/reconciled/locked/waiting dates, category outcomes, duration, and redacted errors without raw health payloads. Set `TODAY_INGESTION_MODE=device` for Apple Health testing. Use `development` only when deterministic local fallback is explicitly intended.

Finalization orchestration can also be invoked by scheduler infrastructure without duplicating accounting logic:

```bash
npm run bank:orchestrate -- --trigger=scheduled
```

Supported CLI triggers are `scheduled`, `manual_refresh`, and `integration_test`. The command retries the prior two local dates and locks expired provisional records through the same idempotent services used after device sync.

For deterministic local history, seed completed bank reports explicitly:

```bash
npm run bank:seed
```

The seed script creates representative completed days through the same idempotent posting service used by tests. Historical seed dates lock when read; rerunning the script cannot duplicate reports, versions, or ledger transactions.

For physical iPhone testing, `localhost` on the phone points to the phone, not the Mac. Set the mobile API URL to the Mac's LAN IP address, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.154:3000
```

Copy `apps/mobile/.env.example` to an untracked local env file and replace the example IP with the Mac's current LAN IP before launching the development client. Expo SDK 54 inlines statically referenced `EXPO_PUBLIC_` values, so restart Metro after changing this file.

## Run Mobile

From the repository root:

```bash
npm run mobile:start -- --clear
```

This starts Metro for the installed development client. It does not start Expo Go.

Other root mobile commands:

```bash
npm run mobile:ios
npm run mobile:android
npm run mobile:web
```

### Physical iPhone Development Build

HealthKit requires a native development build. Expo Go cannot load the HealthKit module.

1. Make sure the iPhone and development machine are on the same network and the iPhone trusts the Mac.
2. Confirm `apps/api/.env` uses `TODAY_INGESTION_MODE=device` and start the API with `npm run api:dev`.
3. Generate native iOS configuration with `npm run mobile:prebuild:ios`.
4. Connect the unlocked iPhone and run `npm run mobile:ios:device`. Select the device and signing team when prompted.
5. After the first native installation, run `npm run mobile:start -- --clear` for normal JavaScript iteration and open the CalorieBank development client.
6. Open Settings -> Health Connections -> Connect Apple Health. Grant read access to active energy, basal energy, dietary energy, steps, and workouts.

Rebuild the native client after adding or changing a native dependency, entitlement, purpose string, bundle identifier, or Expo native configuration. JavaScript-only changes need only Metro reload.

CalorieBank cannot determine whether a HealthKit read category was denied; an empty query can also mean no matching samples. System authorization is managed in iOS Settings or the Health app. `Disconnect in CalorieBank` disables the local connection state but does not claim to revoke system permission.

## Checks

From the repository root:

```bash
npm run lint
npm run typecheck
npm run test
```

`npm run test` currently runs only workspaces that define a test script.

## Legacy Prototype

The existing web frontend and Mongo API were moved under `legacy/` unchanged so the prototype remains available as reference while mobile V1 is built in `apps/` and `packages/`.
