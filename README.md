# CalorieBank

Smart calorie planning through calorie banking.

Helping people enjoy the foods they love while continuing to make progress toward their fitness goals.

[![React Native](https://img.shields.io/badge/React%20Native-20232A?style=flat&logo=react&logoColor=61DAFB)](#technology-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](#technology-stack)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](#technology-stack)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](#technology-stack)
[![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)](#technology-stack)

- **Live Demo:** https://caloriebank-pi.vercel.app
- **Website:** https://philbk.dev
- **Architecture Walkthrough:** [docs/architecture/current-state-audit.md](docs/architecture/current-state-audit.md)

## The Problem

Most nutrition tools are built around restriction: log everything, stay under a number, and treat higher-calorie days as failures. That model can make planning enjoyable meals feel harder than it needs to be, especially for people who want flexibility without losing sight of their fitness goals.

## Why I Built It

Most nutrition apps focus on tracking food after it has already been eaten. CalorieBank focuses on helping people plan ahead by translating connected intake and expenditure data into a clear bank balance they can use to make better decisions before meals, events, and treats happen.

## Product Philosophy

Building software is the easy part. Building software people trust, understand, and want to keep using is the harder problem.

CalorieBank is designed around that constraint. The product does not try to punish users for imperfect days or overwhelm them with raw nutrition data. It turns complex calorie inputs into a simple planning model: what is available, why it changed, and how it affects the choices ahead.

## Product Overview

CalorieBank is a calorie-planning product built around calorie banking. Instead of making each day feel isolated, it helps users understand how completed days contribute to a running bank that can support future plans.

The V1 direction is connection-first: supported data sources provide intake and total-expenditure data, CalorieBank calculates bank changes, records traceable ledger entries, and explains the balance through clear morning updates and bank history. Planning Database entries help users compare future meals or events against the bank without logging confirmed intake or changing the ledger.

The result is a more flexible nutrition experience: users can keep making progress while planning for foods and events they care about.

## Key Features

**Planning**

- Compare future meal and event estimates against the available bank.
- Use Planning Database entries as planning estimates without turning them into confirmed intake.
- Keep planned treats separate from actual food tracking and ledger changes.

**Automatic Banking**

- Sync supported intake and expenditure data sources.
- Calculate completed-day bank contributions from imported totals.
- Maintain immutable ledger-style balance records with traceable changes.

**Progress**

- Show Available Bank as the primary balance.
- Provide Bank History for completed-day changes and explanations.
- Send one meaningful morning bank update instead of noisy calorie alerts.

**Secure Accounts**

- Keep user-owned nutrition data scoped to the authenticated user.
- Keep secrets and provider credentials out of the client.
- Treat connected data sources as the source of truth for consumed intake.

**Personalized Experience**

- Configure goal mode and deficit/surplus adjustments when applicable.
- Keep current-day activity context visible without turning estimates into bank deposits.
- Introduce optional capabilities progressively when they are relevant and understandable.
- Deepen Today's Forecast with time-aware pace and feasibility guidance only after both forecast confidence and user-readiness requirements are satisfied.

## Architecture

CalorieBank is structured as a mobile-first client-server system. The frontend presents the planning experience, the API validates requests and coordinates application services, domain packages own banking rules, the database stores traceable records, and provider/cloud boundaries handle ingestion and infrastructure concerns.

```text
Frontend
  ↓
API
  ↓
Business Logic
  ↓
Database
  ↓
Cloud / Provider Integrations
```

The architecture is intentionally split so product UI decisions do not leak into bank calculations. Banking logic belongs in `packages/domain`, shared API schemas belong in `packages/schemas`, and mobile/provider ingestion uses normalized boundaries before data can affect completed-day accounting.

For the current implementation state and architecture notes, see [docs/architecture/current-state-audit.md](docs/architecture/current-state-audit.md).

## Engineering Decisions

**Why React Native and Expo**

CalorieBank is moving toward an iPhone-first V1 because the most useful nutrition and expenditure data lives closest to the device. Expo keeps the mobile workflow productive while still allowing a native development build for HealthKit, which is required for real device ingestion.

**Why a Node API**

The API keeps validation, orchestration, and persistence behind a server boundary. That matters because the bank should be calculated from trusted inputs and traceable rules, not from client-side assumptions.

**Why domain packages**

Banking logic is isolated in shared domain code so calculations can be tested, versioned, and reused without being tied to a screen or route handler. This also makes product decisions easier to audit against the PRD and ADRs.

**Why PostgreSQL for V1**

The mobile V1 uses PostgreSQL for structured records, migrations, and ledger-style accounting. Immutable balance transactions and reconciliation behavior benefit from relational constraints and explicit migration history.

**Why provider-neutral ingestion**

HealthKit is the first native provider boundary, but domain logic should not depend on provider-specific payloads. Normalized ingestion keeps future providers possible without adding provider switches to bank calculations.

**Why mobile-first V1**

The original web prototype proved the concept. The mobile V1 focuses on the daily context where the product is most useful: morning updates, connected health data, bank visibility, and planning decisions made before real meals and events.

## Technology Stack

**Frontend:** Expo, React Native, Expo Router, TypeScript

**Backend:** Node.js, API routes and service orchestration

**Database:** PostgreSQL, Prisma

**Cloud:** Apple HealthKit device ingestion, provider-neutral sync boundaries

**Authentication:** Clerk-backed beta identity maps verified external subjects to internal CalorieBank UUIDs; the stable development user remains an explicit local-only option

**Tooling:** npm workspaces, TypeScript, shared config packages, linting, tests

## Development Workflow

Modern AI-assisted development accelerated investigation, implementation, debugging, and documentation work on CalorieBank. I used it as a development aid for reading unfamiliar code paths, comparing options, drafting changes, and checking edge cases faster.

Architectural decisions, product scope, validation, testing, and final verification remained under human review. The important engineering work was deciding what should be built, what should not be built yet, and whether each change respected the product documents, ADRs, and bank-calculation rules.

## Repository Documentation

The sections below preserve the repository implementation guidance, product source-of-truth hierarchy, local setup commands, API notes, mobile development workflow, and validation instructions.

## Source-of-Truth Hierarchy

CalorieBank is moving from a web prototype into an iPhone-first mobile V1. The current source-of-truth hierarchy is:

1. `AGENTS.md` defines repository implementation guardrails.
2. `docs/product/v1-prd.md` defines authoritative V1 product scope and experience.
3. `docs/product/bank-calculation-spec.md` governs all bank-calculation behavior.
4. `docs/product/adr-011-progressive-feature-discovery.md` governs V1 availability, first-use visibility, recommendation, and contextual activation.
5. `docs/product/adr-012-todays-eating-budget.md` governs Today's Eating Budget product boundaries and unresolved calculation requirements.
6. `docs/product/adr-013-banking-goals.md` governs Banking Goals, one-bank conservation, allocation concepts, and unresolved withdrawal policy.
7. `docs/product/adr-014-progressive-familiarity.md` governs recommendation readiness, complementarity, and pacing.
8. `docs/product/adr-015-time-aware-activity-forecasting.md` governs advanced time-aware forecasting, forecast confidence, and burn-target feasibility.
9. `docs/product/adr-016-authoritative-provider-selection-and-multi-provider-resolution.md` governs authoritative provider roles and the Fitbit/Google Health transport.
10. `docs/product/adr-017-multi-provider-wearable-integration-strategy.md` governs wearable capability qualification and Garmin, WHOOP, and Apple Health expansion.
11. `docs/product/adr-018-direct-nutrition-provider-strategy-and-fatsecret-integration.md` governs direct nutrition providers, FatSecret delegated diary access, and authoritative intake resolution.
12. `docs/product/adr-019-beta-identity-and-environment-boundary.md` and `docs/product/adr-020-opening-bank-and-recovery-presentation.md` govern identity ownership and the opening/recovery accounting boundary.
13. `docs/product/adr-021-personalized-step-contribution-and-initial-visibility.md` governs ledger-neutral walking estimates and the one-time Steps visibility default.
14. `docs/product/adr-001-connection-first-v1.md` through `docs/product/adr-010-reliable-historical-sync-and-finalization-orchestration.md` govern their focused accepted decisions.
15. `docs/architecture/current-state-audit.md` records implementation state and planning but cannot override the product documents above.

## V1 Mission

CalorieBank V1 validates whether users can connect their existing health and calorie data, understand and trust an automatically updated calorie-bank balance, and use the morning bank update to plan enjoyable foods with less friction and guilt.

CalorieBank is not being built first as a replacement food logger. The first-user product is an automatic interpretation and planning layer over supported calorie-intake and calorie-expenditure data sources.

V1 includes a Planning Database for future meal and event estimates. It is not the food log. Connected calorie-tracking applications remain the source of truth for consumed intake and bank calculations.

V1 scope does not require every capability to appear during onboarding or first use. ADR 011 keeps the initial experience focused on the bank and governs contextual relevance; ADR 014 requires familiarity and workflow complementarity before optional planning, forecasting, reserve, or personalization capabilities are proactively introduced. Manual access remains available where practical. Today's Forecast and Projected Daily Burn remain V1 estimates; no Projected Bank is approved.

### Canonical First Run

The V1 mobile journey is: authenticate -> connect calories burned -> connect calories eaten -> configure the goal -> prepare the Opening Bank -> Today. Setup is resumable. Provider connections and authoritative role selection, the saved goal, and Opening Bank initialization remain authoritative; the profile stores only whether welcome was completed and whether the ready state was acknowledged. Existing users migrated before this flow are not forced through it again.

Consumer-facing provider choices are intentionally limited to Fitbit/Google Health or valid Apple Health expenditure for calories burned, and FatSecret or Apple Health Dietary Energy for calories eaten. The app never combines competing providers. While Opening Bank is waiting for sufficient completed-day inputs, setup shows a preparation state rather than inventing a zero balance.

ADR 014 adds Progressive Familiarity. A proactive recommendation requires Relevance, Familiarity, and Complementarity; account age, days since signup, and session count alone do not establish readiness. This policy controls recommendations, not manual feature access.

ADR 015 extends Today's Forecast with future Time-Aware Activity Forecasting. It may evaluate current pace, remaining time, a selected burn target, walking-only feasibility, and familiar-activity scenarios, but numeric production behavior is blocked until the forecast method and confidence policy are approved. Reliable data and user familiarity are independent readiness requirements.

Today's Eating Budget is a separate progressively discovered V1 guidance capability. It is neither Available Bank nor Today's Forecast, never changes the ledger, and must not be implemented numerically until ADR 012's provider-semantic, remaining-expenditure, and goal-mapping decisions are resolved.

Banking Goals is a progressively discovered V1 Planning capability. It organizes real finalized Available Bank calories among user-created purposes and Unassigned calories; it does not create independent banks or a second ledger. Production implementation is blocked until ADR 013's protection, withdrawal-allocation, Emergency Bank ordering, and correction policies are resolved.

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

This branch includes the mobile/API foundation, Clerk-backed beta identity boundary, foreground Apple Health ingestion, server-side Google Health API ingestion of Fitbit-derived expenditure, direct FatSecret daily-intake ingestion, explicit authoritative-provider selection, and the provisional bank pipeline. Current day remains awareness-only. Render private beta uses an hourly account-wide lifecycle job for authoritative server-readable sources; Apple Health remains device-only and catches up on authenticated foreground. Completed days post only after both authoritative roles have exact-date post-day-end query evidence, remain correctable for two local calendar days, and then lock. Push/local notifications and background HealthKit delivery remain deferred.

The first implementation milestones should prioritize connection-first onboarding, technically credible supported data-source sync, automatic bank calculation, transparent history, Planning Database estimates for future meals/events, and the morning bank update. Manual food logging is a fallback/correction path, not the dominant V1 loop. Bank-calculation behavior, including Available Bank, optional Emergency Bank, Recovery Forecast, and reserve-policy history, is governed by `docs/product/bank-calculation-spec.md`. Automatic bank usage and dashboard awareness are recorded in `docs/product/adr-004-automatic-bank-usage-and-dashboard-awareness.md`.

Future personalized Activity Opportunity Engine work is documented in `docs/product/adr-005-personalized-activity-opportunity-notifications.md`. It is intentionally deferred until real intake/expenditure ingestion, Today-so-far awareness, notification consent, stable Planned Treat timing, and explicit activity preferences exist. Estimated activity calories must never be deposited into the bank or treated as actual expenditure.

Provider-neutral ingestion is documented in `docs/product/adr-006-provider-neutral-ingestion-architecture.md`. Apple Health is the first real device adapter and is documented in `docs/product/adr-007-apple-healthkit-device-ingestion.md`. Current-day steps, workouts, sync-session observability, and dashboard visibility rules are documented in `docs/product/adr-008-activity-context-and-customizable-today.md`. Provisional posting and reconciliation are authoritative in `docs/product/adr-009-provisional-finalization-and-rolling-reconciliation.md`; reliable three-day historical sync and orchestration are governed by `docs/product/adr-010-reliable-historical-sync-and-finalization-orchestration.md`. Development adapters remain test-only or explicitly enabled local fallback; device and production modes must not silently return synthetic calories.

Authoritative provider selection and Fitbit are governed by `docs/product/adr-016-authoritative-provider-selection-and-multi-provider-resolution.md`. Expenditure, activity context, and intake have distinct authoritative roles. Selecting Fitbit uses verified Google Health API v4 data for expenditure, steps, and workouts; Apple Health remains intake. Provider values and workout lists are never summed or merged.

Multi-provider wearable expansion is governed by `docs/product/adr-017-multi-provider-wearable-integration-strategy.md`. The supported V1 connection surface is Fitbit/Google Health, Apple Health, and FatSecret. WHOOP and Garmin are deferred and do not appear in the mobile product. Their provider-neutral research and dormant infrastructure remain available for future evaluation.

Direct nutrition ingestion is governed by `docs/product/adr-018-direct-nutrition-provider-strategy-and-fatsecret-integration.md`. FatSecret users connect their existing diary through delegated OAuth 1.0; CalorieBank imports only normalized daily calorie totals. Apple Health Dietary Energy remains a first-class intake source and bridge for compatible nutrition apps. ADR 022 requires one selected Apple Health writer and prohibits all-writer intake totals. The selected intake source is authoritative and provider totals are never summed.

Progressive Feature Discovery is governed by `docs/product/adr-011-progressive-feature-discovery.md`. Available Bank remains mandatory and first, while implemented optional cards may be manually discoverable or proactively introduced only after sufficient data and all ADR 014 gates are satisfied. Transparency, errors, safety information, and active recovery guidance are never discovery-gated.

Progressive Familiarity is governed by `docs/product/adr-014-progressive-familiarity.md`. When several capabilities are ready, recommend the one with the highest immediate value and delay the others until familiarity or context changes. Do not use unlocks, levels, or stacked introductions.

Banking Goals is governed by `docs/product/adr-013-banking-goals.md`. Conceptually, active goal allocations plus Unassigned calories must always equal Available Bank. Emergency Bank remains separate, projected activity cannot fund goals, and goal attribution must never duplicate the automatic finalized withdrawal.

The user-facing Available Bank never displays below zero. ADR 020 preserves the truthful effective accounting balance while deriving `availableBankCalories = max(0, effectiveBankBalanceCalories)` and `recoveryCalories = max(0, -effectiveBankBalanceCalories)`. Recovery is not a second ledger: later positive contributions restore the same effective balance. A new user initializes once from at most seven eligible prior completed local days, with negative pre-CalorieBank net floored to zero. Existing users are not retroactively floored. Emergency Bank remains optional, separate, deferred, and hidden by default.

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

Update `DATABASE_URL` and `SHADOW_DATABASE_URL` if your PostgreSQL username, password, host, port, or database names differ. `DEV_USER_ID` and `DEV_USER_EMAIL` are accepted only with `APP_ENV=local` and `AUTH_MODE=development`. Beta and production fail closed unless Clerk keys are configured.

### Identity and beta environments

ADR 019 governs identity and ownership. In Clerk mode, the Expo app stores its session token in Secure Store and sends it as a bearer credential. The API verifies it, maps each Clerk subject to exactly one internal UUID (provisioning an unseen subject as a fresh user), and derives all `/v1/me/*` ownership from that mapping. OAuth callbacks identify their owner from server-side state/request-token records rather than the callback request. A local API running `AUTH_MODE=development` rejects Clerk bearer credentials rather than silently resolving them as `DEV_USER_ID`; physical Clerk testing must run the API with `AUTH_MODE=clerk` and both server-side Clerk keys.

For an existing local account, first create the intended Clerk account, find its Clerk user ID, and explicitly link it without rewriting owned data:

```bash
npm run auth:link-existing -- "$DEV_USER_ID" "user_CLERK_SUBJECT"
```

Do not use a placeholder subject. The command refuses conflicting links. A beta environment additionally needs a stable HTTPS API, a separate beta database, stable Google Health and FatSecret callbacks, `APP_ENV=beta`, `AUTH_MODE=clerk`, Clerk keys, and provider secrets supplied by the host. Configure `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_MODE=clerk`, and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in the EAS `preview` environment. Production uses separate values and is not claimed as deployed.

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

The effective bank is the immutable Opening Bank snapshot, when applicable, plus append-only initial and correction ledger transactions after the accounting activation date. `GET /v1/me/bank-summary` exposes `effectiveBankBalanceCalories`, non-negative `availableBankCalories`, and non-negative `recoveryCalories` explicitly. A completed active-accounting day affects the bank immediately as provisional, can receive append-only correction deltas for two local calendar days, and then becomes locked. Range filters affect the history list and `rangeNetChangeCalories`; they do not replace the all-time effective bank.

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
GET /v1/me/provider-selection
PUT /v1/me/provider-selection
GET /v1/me/integrations/fitbit/authorize
GET /v1/me/integrations/fitbit/callback
POST /v1/me/integrations/fitbit/sync
DELETE /v1/me/integrations/fitbit
GET /v1/me/integrations/fatsecret
GET /v1/me/integrations/fatsecret/authorize
GET /v1/me/integrations/fatsecret/callback
POST /v1/me/integrations/fatsecret/sync
DELETE /v1/me/integrations/fatsecret
GET /v1/me/dashboard-preferences
PATCH /v1/me/dashboard-preferences
```

`GET /v1/me/today` returns current-day adjusted burned calories, calories eaten, cumulative steps, and normalized logged workouts with independent freshness states. It is read-only and must not project a bank change, mutate ledger rows, or change Available Bank. Step and workout calories are never added to active-plus-basal expenditure.

The ingestion commands are the device-to-server boundary for normalized daily summaries. They do not accept a user ID, adjusted expenditure, or bank effects. Each foreground sync independently queries and uploads current day, yesterday, and the day before. Current-day data remains awareness-only. Completed-date expenditure and intake updates invoke idempotent provisional posting or reconciliation; steps and workouts never do. The API applies the centralized `0.80` policy, replaces newer cumulative totals, and ignores stale updates. The device skips accepted unchanged values and retains failed uploads in an ordered local outbox. Coordinated sync sessions retain queried/uploaded/skipped/reconciled/locked/waiting dates, category outcomes, duration, and redacted errors without raw health payloads. Set `TODAY_INGESTION_MODE=device` for Apple Health testing. Use `development` only when deterministic local fallback is explicitly intended.

Google OAuth and Google Health API requests run on the server because the service is internet-accessible and its client secret must never enter mobile JavaScript. `POST /v1/me/integrations/fitbit/sync` retrieves current day, yesterday, and the day before independently. It uses `total-calories:dailyRollUp` for expenditure, `steps:dailyRollUp` for cumulative steps, and civil-day-filtered `exercise` data points for workout sessions. `totalCalories.kcalSum` is the one raw expenditure total; workout calories are context and are never added. CalorieBank applies `0.80` once. Selecting Fitbit affects provisional calculations through expenditure only and never rewrites locked days.

Inspect existing development history without changing it:

```bash
npm run bank:inspect-providers
```

### Fitbit through Google Health Development Setup

The legacy Fitbit Web API is scheduled to shut down in September 2026. New CalorieBank connections therefore use [Google Health API v4](https://developers.google.com/health/) and Google OAuth; the legacy transport is not registered in production code.

1. Create or select a Google Cloud project, then enable **Google Health API** from the API Library. Follow Google's [Cloud and OAuth setup](https://developers.google.com/health/setup).
2. Configure the Google Auth Platform consent screen as **External** for development. Add the Google/Fitbit account used on the iPhone under **Audience -> Test users**.
3. Under **Data Access**, add only `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`. CalorieBank does not request write, nutrition, sleep, location, profile, or health-metrics scopes for this adapter.
4. Create an OAuth 2.0 client of type **Web application**. Register the exact externally reachable HTTPS callback ending in `/v1/me/integrations/fitbit/callback`. A physical iPhone cannot use Mac `localhost`; use a stable HTTPS development tunnel or deployed development API. The `caloriebank://` URL is the post-callback app redirect and is not the Google OAuth redirect URI.
5. Put the issued Client ID and Client Secret only in untracked `apps/api/.env`. Generate a local token-encryption key with `openssl rand -base64 32`.
6. Configure the following and restart the API:

```env
GOOGLE_HEALTH_CLIENT_ID=your_client_id
GOOGLE_HEALTH_CLIENT_SECRET=your_client_secret
GOOGLE_HEALTH_REDIRECT_URI=https://your-development-api.example/v1/me/integrations/fitbit/callback
GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY=your_base64_32_byte_key
```

7. Open Settings -> Health Connections -> Connect Fitbit, sign in to the allowlisted Google account, grant activity-and-fitness read access, then select **Use Fitbit for burn and activity**.

OAuth state is hashed, the PKCE verifier and tokens are encrypted at rest, refresh-token rotation is preserved when Google returns a replacement, and tokens are excluded from request logs. In Google's Testing publishing mode, refresh tokens expire after seven days. Unverified apps are limited to 100 users; public launch requires OAuth verification and the Google Health restricted-scope security process. Production must use managed secret storage and a stable HTTPS callback.

### FatSecret Direct Intake Development Setup

FatSecret existing-user diary access uses the platform's [three-legged OAuth 1.0 flow](https://platform.fatsecret.com/docs/guides/authentication/oauth1/three-legged). OAuth 2.0 client credentials cannot delegate access to a member's private diary.

1. Register for the [FatSecret Platform API](https://platform.fatsecret.com/) and create an application that provides an OAuth 1.0 Consumer Key and Consumer Secret. Use the credentials issued by FatSecret; do not substitute an OAuth 2.0 Client ID.
2. Configure the callback used by the application as the exact public HTTPS API URL ending in `/v1/me/integrations/fatsecret/callback`. For iPhone development, this may be the same stable ngrok or other HTTPS tunnel used for Google OAuth. The `caloriebank://integrations` URI is the post-callback mobile redirect, not the FatSecret callback.
3. Generate or reuse the external-provider encryption key with `openssl rand -base64 32`, then add only these values to untracked `apps/api/.env`:

```env
EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY=your_base64_32_byte_key
FATSECRET_CONSUMER_KEY=your_oauth1_consumer_key
FATSECRET_CONSUMER_SECRET=your_oauth1_consumer_secret
FATSECRET_REDIRECT_URI=https://your-development-api.example/v1/me/integrations/fatsecret/callback
```

4. Restart the API and keep the HTTPS tunnel pointed at API port `3000`. Restart Metro only when JavaScript or `EXPO_PUBLIC_API_URL` changes.
5. On the iPhone, open Settings -> Health Connections -> Connect FatSecret. Sign in to the existing FatSecret account and approve access, then select **Use FatSecret for calories eaten**.
6. Refresh Today and compare Eaten with the FatSecret diary total. Edit yesterday's diary, refresh again, and verify one provisional correction delta. Repeating the refresh without another edit must not create another correction.

CalorieBank reads FatSecret's monthly diary summary and persists only daily calorie totals. Omitted diary dates remain unavailable rather than becoming zero. It does not import individual foods or edit the diary. The delegated OAuth flow was successfully completed on a physical iPhone development build on 2026-08-18; this validates connection and return-to-app behavior, not production-scale synchronization. No EAS rebuild is required for this integration because it adds no native dependency or configuration.

### Deferred Wearable Providers

WHOOP and Garmin are not part of the user-facing V1 connection surface. The mobile app must not offer Connect, selection, status, or setup controls for either provider.

WHOOP's dormant workout-context adapter and generic OAuth persistence remain architecture for possible later use, but workout-only context does not justify V1 connection complexity and cannot provide CalorieBank's required local-day total expenditure. Garmin remains capability research only until Developer Program access and approved documentation establish calorie semantics and commercial terms. ADR 017 retains the detailed technical investigation for both providers.

Finalization orchestration can also be invoked by scheduler infrastructure without duplicating accounting logic:

```bash
npm run bank:orchestrate -- --trigger=scheduled
```

Supported CLI triggers are `scheduled`, `manual_refresh`, and `integration_test`. The command retries the prior two local dates and locks expired provisional records through the same idempotent services used after device sync.

The private-beta account-wide scheduler uses `npm run lifecycle:run`, not the development-only single-user command above. Render deployment and EAS beta environment requirements are documented in `docs/deployment/render-private-beta.md`.

For deterministic local history, seed completed bank reports explicitly:

```bash
npm run bank:seed
```

The seed script creates representative completed days through the same idempotent posting service used by tests. Historical seed dates lock when read; rerunning the script cannot duplicate reports, versions, or ledger transactions.

For physical iPhone testing, `localhost` on the phone points to the phone, not the Mac. Set the mobile API URL to the Mac's LAN IP address, for example:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_MAC_LAN_IP:3000
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

Development-profile iOS builds include `NSAllowsLocalNetworking` and a local-network usage description so the physical iPhone can reach the Mac API over private-LAN HTTP. Preview and production profiles do not include this exception and continue requiring HTTPS. The LAN IP remains an environment value and is not hard-coded into the app.

For an EAS development client, build and install with:

```bash
cd apps/mobile
eas build --platform ios --profile development
```

For local native generation, explicitly enable the same development-only configuration:

```bash
CALORIEBANK_IOS_ALLOW_LOCAL_HTTP=1 npm run mobile:prebuild:ios
```

Rebuild the native client after adding or changing a native dependency, entitlement, purpose string, bundle identifier, ATS policy, or Expo native configuration. JavaScript-only changes need only Metro reload.

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
