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

This branch includes the mobile/API foundation and the first finalized-bank read model. Product direction no longer uses a user-entered absolute daily calorie target; V1 derives allowance from imported total daily expenditure, CalorieBank's `0.80` adjustment, and the user's goal-mode adjustment. Any existing endpoint, payload, or database naming that still says "target" is transitional implementation debt and requires a separate migration task. Production authentication, live integration sync, notifications, and midnight/background finalization jobs are intentionally deferred.

The first implementation milestones should prioritize connection-first onboarding, technically credible supported data-source sync, automatic bank calculation, transparent history, Planning Database estimates for future meals/events, and the morning bank update. Manual food logging is a fallback/correction path, not the dominant V1 loop. Bank-calculation behavior, including Available Bank, optional Emergency Bank, Recovery Forecast, and reserve-policy history, is governed by `docs/product/bank-calculation-spec.md`. Automatic bank usage and dashboard awareness are recorded in `docs/product/adr-004-automatic-bank-usage-and-dashboard-awareness.md`.

Future personalized Activity Opportunity Engine work is documented in `docs/product/adr-005-personalized-activity-opportunity-notifications.md`. It is intentionally deferred until real intake/expenditure ingestion, Today-so-far awareness, notification consent, stable Planned Treat timing, and explicit activity preferences exist. Estimated activity calories must never be deposited into the bank or treated as actual expenditure.

The user-facing Available Bank never displays below zero. Users may optionally reserve genuinely accumulated calories in an Emergency Bank for unexpected overages. The V1 protection sequence is Available Bank -> optional Emergency Bank -> Recovery Forecast, rather than making a large negative balance the primary focus.

## Requirements

- Node.js `20.20.2`
- npm
- Expo Go for quick device testing

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

The official bank is the all-time sum of finalized daily ledger transactions. Range filters affect the history list and `rangeNetChangeCalories`; they do not replace the all-time bank.

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

Until real integrations and finalization jobs exist, seed development bank history explicitly:

```bash
npm run bank:seed
```

The seed script creates representative finalized days for the temporary development user through the same idempotent finalization service used by tests. Rerunning it must not create duplicate finalized records or ledger transactions.

For physical iPhone testing, `localhost` on the phone points to the phone, not the Mac. Set the mobile API URL to the Mac's LAN IP address, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.154:3000
```

Copy `apps/mobile/.env.example` to an untracked local env file and replace the example IP with the Mac's current LAN IP before launching Expo Go. Expo SDK 54 inlines statically referenced `EXPO_PUBLIC_` values, so restart Metro after changing this file.

## Run Mobile

From the repository root:

```bash
npm run mobile:start -- --clear
```

Other root mobile commands:

```bash
npm run mobile:ios
npm run mobile:android
npm run mobile:web
```

### Physical iPhone With Expo Go

1. Install Expo Go from the App Store.
2. Make sure the iPhone and development machine are on the same network.
3. Run `npm run mobile:start -- --clear` from the repository root.
4. Scan the QR code with the iPhone camera or Expo Go.
5. If the connection cannot be reached on the local network, switch the Expo CLI connection mode as prompted by Expo.

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
