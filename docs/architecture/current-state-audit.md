# CalorieBank Current-State Architecture Audit

Date: 2026-07-16

## 2026-07-16 Direction Update

The original audit was written when V1 was assumed to be manual-food-logging-first. That assumption is superseded.

The authoritative V1 direction is now connection-first automatic calorie banking: users connect supported calorie-intake and calorie-expenditure/health data sources, configure goal mode and a deficit/surplus adjustment when applicable, receive automatic bank calculations, and get one meaningful morning bank update. Manual food logging remains useful prototype work, but for first-10-user V1 it is fallback/correction/supplementary behavior rather than the promoted product loop.

V1 also includes a Planning Database for future meal and event estimates. That database is planning-only: connected calorie-tracking applications remain the source of truth for Food Tracking, daily intake, historical intake, synchronization, and bank calculations. Planning Database estimates must not directly update the bank.

The approved mobile information architecture is bank-first. The default experience should show the all-time Available Bank first, include finalized days only through the previous completed day, keep the current day pending or explicitly estimated, and reveal history by day/week/month/3 months/year/all time only when requested. Selecting a finalized day reveals a short consumer-readable breakdown. Implementation should preserve immutable finalized daily bank transactions as the source of the all-time bank and should avoid exposing raw internal identifiers or variable names in consumer UI.

The current architecture inventory below remains valid as a description of the existing prototype. Forward-looking reuse, migration, database, and vertical-slice guidance has been updated to match `docs/product/v1-prd.md`. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`; the rejection of absolute user-entered daily calorie targets is recorded in `docs/product/adr-002-expenditure-relative-goal-adjustment.md`.

## 1. Current Architecture

CalorieBank is currently a deployed web prototype split into two independent npm projects:

- `frontend/`: a Vite, React, JavaScript single-page application deployed to Vercel.
- `backend/`: a Node.js, Express, JavaScript API deployed to Render.

The backend connects to MongoDB with Mongoose and owns authentication, daily food-log persistence, extra-burn persistence, weekly bank calculation, and S3 food-photo upload. The frontend uses React Context for auth, food-log state, weekly bank state, and theme state. Client-server communication happens through REST endpoints under `/api/auth`, `/api/foodlog`, and `/api/upload`.

The current domain model is document-oriented:

- A `User` document stores credentials, profile fields, favorite meals/activities, calorie target fields, and TDEE.
- A `FoodLog` document stores one user's day, embedded food entries, embedded burned activities, and a mutable/computed `bankBalance`.
- Weekly banking is calculated by scanning daily logs for the current week and summing completed-day bank values.

This is a useful prototype but does not match the V1 direction of Expo React Native, TypeScript, PostgreSQL, and a transactional calorie ledger.

## 2. Technology and Dependency Inventory

### Repository Structure

- Root docs: `README.md`, `DEPLOYMENT.md`.
- Backend source: `backend/server.js`, `backend/controllers`, `backend/models`, `backend/routes`, `backend/middleware`, `backend/config`, `backend/utils`.
- Frontend source: `frontend/src/pages`, `frontend/src/components`, `frontend/src/context`, `frontend/src/utils`, `frontend/src/index.css`.
- Static/docs assets: `screenshots/*.png`, `frontend/public/favicon.svg`, `frontend/public/icons.svg`.
- Generated/local directories present: `backend/node_modules`, `frontend/node_modules`, `frontend/dist`, `backend/uploads`.

### Backend

- Runtime: Node.js `>=20.19.0`.
- Language: JavaScript ES modules.
- Framework: Express `5.2.1`.
- Database: MongoDB via Mongoose `9.7.1`.
- Auth/security libraries: `jsonwebtoken` `9.0.3`, `bcryptjs` `3.0.3`, `cors` `2.8.6`, `dotenv` `17.4.2`.
- Upload/storage: `multer` `2.2.0`, `@aws-sdk/client-s3` `3.1071.0`.
- Dev tooling: `nodemon` `3.1.14`.
- Scripts: `npm start`, `npm run dev`.

### Frontend

- Runtime/build: Vite `8.0.16`, React plugin `@vitejs/plugin-react`.
- Language: JavaScript with JSX.
- UI framework: React `19.2.7`, React DOM `19.2.7`.
- Routing: `react-router-dom` `7.18.0`.
- Icons/charts: `lucide-react` `1.21.0`, `recharts` `3.8.1`.
- Styling: Tailwind CSS `3.4.17`, PostCSS, Autoprefixer.
- Linting: ESLint `10.5.0`, React Hooks plugin, React Refresh plugin, `globals`.
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

### Deployment and Configuration

- Frontend: Vercel, configured with `frontend/vercel.json` SPA rewrites.
- Backend: Render, documented in `DEPLOYMENT.md`.
- Database: MongoDB Atlas.
- Object storage: AWS S3.
- Env examples: `backend/.env.example`, `frontend/.env.example`.
- A real `backend/.env` file exists in the workspace. It is not tracked by `git ls-files`, but any real secrets should still be rotated if they have been exposed outside the local machine.

## 3. Working Files and Features

### Backend Working Surface

- `backend/server.js`: initializes Express, CORS, JSON parsing, Mongo connection, and routes.
- `backend/controllers/authController.js`: registration, login, bcrypt password hashing, JWT issue, Harris-Benedict TDEE estimate.
- `backend/middleware/auth.js`: bearer-token verification.
- `backend/models/User.js`: user, profile, favorites, target, and TDEE schema.
- `backend/models/FoodLog.js`: daily log with embedded food entries and burned activities.
- `backend/controllers/foodLogController.js`: daily-log creation/fetch, food entry create/update/delete, burned activity create/update/delete, weekly bank calculation, daily duplicate merge.
- `backend/controllers/uploadController.js`: uploads food photos to S3 and writes the resulting URL back to a food entry.
- `backend/utils/normalizeLogDate.js`: normalizes date-only values to local midnight.

### Frontend Working Surface

- `frontend/src/App.jsx`: route layout and protected routes.
- `frontend/src/context/AuthContext.jsx`: local auth persistence and token-derived user hydration.
- `frontend/src/context/FoodLogContext.jsx`: API-facing state manager for food logs, weekly bank, burned activities, and uploads.
- `frontend/src/context/ThemeContext.jsx`: dark-mode persistence.
- `frontend/src/pages/auth/Register.jsx`: account creation and profile/TDEE input.
- `frontend/src/pages/auth/Login.jsx`: login flow.
- `frontend/src/pages/Dashboard.jsx`: daily summary, selected date, food entries, macros, extra burn.
- `frontend/src/pages/AddEntry.jsx`: manual food and macro logging, optional image upload.
- `frontend/src/pages/JoyBankingCenter.jsx`: weekly bank history, treat planning, simple burn estimate.
- `frontend/src/components/Bank/DailyBank.jsx`: weekly bank summary card.
- `frontend/src/components/FoodLog/FoodLogList.jsx`: food-entry list, edit, delete, photo edit.
- `frontend/src/components/Dashboard/BurnedCaloriesLogger.jsx`: activity burn CRUD.
- `frontend/src/components/Dashboard/MacroSummary.jsx`: macro totals.
- `frontend/src/components/Layout/Navbar.jsx`: responsive navigation and auth actions.
- `frontend/src/utils/api.js`: fetch wrapper with base URL and bearer token.

## 4. Code Reusable for Mobile V1

Reusable as product/domain reference:

- Manual food logging fields: food name, calories, protein, carbs, fats, date, optional image. These should be reused only as fallback/correction/supplementary concepts for V1, not as the primary loop.
- Registration profile fields: height, weight, age, sex, activity level, and historical target fields are useful prototype reference only. V1 must replace absolute daily calorie target behavior with goal mode plus signed goal adjustment.
- TDEE calculation concept, with medical/fitness disclaimers and formula review before production.
- Extra-burn logging concept and CRUD behavior, especially source labeling and correction semantics for future imported expenditure data.
- Daily and weekly summary UX as reference for balance explanations and history, not for a food-log-centered home screen.
- Treat-planning/Joy Bank concept can inform the V1 Planning Database and saved food/meal/event planning feature.
- API route intent: auth, daily log, food entry, activity burn, weekly summary. V1 API design should instead prioritize integrations, sync status, imported records, ledger/history, notifications, and corrections.
- Date-only log concept using `YYYY-MM-DD` as a user-visible day key.
- Screenshot and README material as product-reference artifacts.

Reusable with modification:

- `normalizeLogDate` logic should become a TypeScript date utility that explicitly handles user timezone and date-only strings.
- TDEE calculation should move into a typed shared or backend domain module with unit tests.
- Existing REST endpoint names can inform V1 API naming, but payloads should be versioned and validated.
- UI hierarchy can inspire React Native screens, but components must be rewritten with native primitives.
- Prototype food-log state can inform manual correction/fallback flows, but should not drive onboarding, retention, or first beta success metrics. It should not be reused as the Planning Database without separating future planning estimates from confirmed intake.

## 5. Code That Should Be Rewritten

- Entire frontend implementation should be rewritten for Expo React Native and TypeScript. The current app depends on DOM APIs, browser `localStorage`, React Router DOM, file inputs, browser CSS, Tailwind web classes, and web-only navigation.
- Backend should be rewritten or heavily refactored into TypeScript with explicit module boundaries, validation, typed request/response contracts, PostgreSQL access, migrations, and tests.
- Mongo/Mongoose models should not be carried forward because V1 calls for PostgreSQL and a transactional ledger.
- Current mutable `FoodLog.bankBalance` should be replaced with derived balances from ledger transactions.
- Current embedded `entries` and `burnedActivities` arrays should become relational rows.
- Photo upload should be postponed unless it becomes essential to a validated correction/fallback flow. If kept, it should use stricter MIME validation, object ownership records, and private object access.
- Client-side JWT decoding and browser token storage should be replaced with mobile-appropriate secure token storage and server-backed session/token validation.
- Joy Bank local-storage treat plan should be redesigned as a saved food/meal/event goal that complements automatic bank updates.

## 6. Technical Debt, Security Issues, and Architectural Risks

- No TypeScript in source despite V1 requiring TypeScript.
- No automated tests found for frontend, backend, date behavior, auth, ledger math, or API contracts.
- No request validation library. Controllers rely on manual checks and coercion.
- No database migrations. Mongo schema changes are implicit.
- No transactional ledger. Current bank state is stored as mutable/computed daily document data.
- Date handling is duplicated in multiple controllers and mixes local midnight with UTC fallback queries.
- Daily-log duplicate repair is embedded in request handling and can hide data-shape problems.
- `bankBalance` semantics differ between current day and prior days; today is excluded from weekly bank in several places.
- TDEE and daily target semantics are unclear: daily bank uses TDEE plus extra burn minus consumed calories, while UI also displays `dailyCalorieIntake`.
- JWT payload includes user profile values that can become stale.
- JWT is stored in browser `localStorage`, which is vulnerable to token theft through XSS.
- No refresh-token/session model, token revocation, password reset, email verification, rate limiting, or account deletion flow.
- CORS origins are hard-coded in `server.js`.
- MongoDB Atlas guidance suggests `0.0.0.0/0`, acceptable only for early development and risky for production.
- S3 upload accepts any client-provided image MIME within size limits and constructs public URLs directly.
- S3 objects appear public by URL; there is no object-level ownership table or signed URL strategy.
- `backend/.env` exists locally. It is not tracked, but real secrets should be rotated if there is any chance of leakage.
- `node_modules`, `frontend/dist`, and `backend/uploads` exist in the workspace and should remain ignored/generated.
- No centralized error model or structured logging.
- No OpenAPI spec or typed API contract shared with the client.
- No health check beyond root text response.
- No privacy/data-retention model for nutrition and health-adjacent data.
- The current product has health and fitness-adjacent claims. V1 should use careful language and avoid medical claims.
- No integration authorization model, sync state model, import batch model, duplicate prevention strategy, or notification pipeline exists yet.
- Current docs and prototype UI over-emphasize food logging relative to the updated connection-first V1 mission.

## 7. Monorepo vs Clean Repository

Recommendation: keep this repository and turn it into a clean monorepo, but treat current code as legacy/reference during migration.

Rationale:

- The current repository contains useful product history, screenshots, docs, deployed prototype behavior, and known user flows.
- V1 naturally has at least two deployable apps: Expo mobile app and Node/Express API.
- Shared TypeScript types, validation schemas, date utilities, and ledger domain logic will reduce client/server drift.
- A monorepo allows one issue/PR trail for coordinated API and mobile work.

A clean repository would only be safer if the current repository has leaked secrets in git history, has production data mixed into source, or must preserve the web prototype unchanged while V1 proceeds independently. `git ls-files` does not show `backend/.env` tracked, but git history should still be checked before beta.

Suggested approach: create a V1 branch, keep the current prototype under `legacy/` or preserve it until replaced, and introduce the target monorepo structure incrementally.

## 8. Proposed Target Folder Structure

```text
CalorieBank/
├── apps/
│   ├── mobile/                  # Expo React Native app, TypeScript
│   │   ├── app/                 # Expo Router screens
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── theme/
│   │   └── app.config.ts
│   └── api/                     # Express API, TypeScript
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── integrations/
│       │   │   ├── sync/
│       │   │   ├── imported-records/
│       │   │   ├── activity/
│       │   │   ├── notifications/
│       │   │   ├── corrections/
│       │   │   ├── saved-items/
│       │   │   └── ledger/
│       │   ├── db/
│       │   ├── middleware/
│       │   ├── routes/
│       │   ├── config/
│       │   └── server.ts
│       └── migrations/
├── packages/
│   ├── domain/                  # Ledger math, TDEE, date utilities
│   ├── schemas/                 # Zod schemas and API DTOs
│   └── config/                  # Shared TS/ESLint/Prettier config
├── legacy/
│   ├── web-frontend/            # Current Vite app, if retained
│   └── mongo-api/               # Current Express/Mongoose API, if retained
├── docs/
│   └── architecture/
├── scripts/
└── package.json
```

## 9. Proposed Database Model

Use PostgreSQL with UUID primary keys, timestamps, explicit ownership, and append-only ledger rows.

### Core Tables

`users`

- `id uuid primary key`
- `email citext unique not null`
- `username text`
- `password_hash text`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

`user_profiles`

- `user_id uuid primary key references users(id)`
- `height_cm numeric`
- `weight_kg numeric`
- `birthdate date` or `age_years integer` for beta
- `sex text`
- `activity_level text`
- `timezone text not null default 'America/Chicago'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`goal_adjustment_snapshots`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `goal_mode text not null` (`cut`, `maintain`, `bulk`)
- `daily_energy_adjustment integer not null`
- `adjustment_source text not null` (`manual_calories`, `estimated_weight_rate`)
- `desired_weekly_weight_change numeric`
- `calculation_policy_version text not null`
- `effective_from date not null`
- `effective_to date`
- `created_at timestamptz not null`

`integration_connections`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `provider text not null`
- `connection_type text not null` (`intake`, `expenditure`, `health`, `import`)
- `status text not null` (`connected`, `revoked`, `error`, `pending`)
- `scopes text[]`
- `authorized_at timestamptz`
- `revoked_at timestamptz`
- `last_successful_sync_at timestamptz`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`sync_batches`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `integration_connection_id uuid references integration_connections(id)`
- `status text not null` (`pending`, `success`, `partial`, `failed`)
- `started_at timestamptz not null`
- `completed_at timestamptz`
- `source_window_start timestamptz`
- `source_window_end timestamptz`
- `error_code text`
- `created_at timestamptz not null`

`imported_intake_records`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `sync_batch_id uuid references sync_batches(id)`
- `source_record_id text`
- `source_name text not null`
- `log_date date not null`
- `calories integer not null check (calories >= 0)`
- `recorded_at timestamptz`
- `confidence_state text not null` (`confirmed`, `pending`, `estimated`, `incomplete`)
- `created_at timestamptz not null`
- Unique index candidate: `(user_id, source_name, source_record_id)` when source IDs exist.

`imported_expenditure_records`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `sync_batch_id uuid references sync_batches(id)`
- `source_record_id text`
- `source_name text not null`
- `log_date date not null`
- `calories integer not null check (calories >= 0)`
- `expenditure_type text`
- `recorded_at timestamptz`
- `confidence_state text not null` (`confirmed`, `pending`, `estimated`, `incomplete`)
- `created_at timestamptz not null`
- Unique index candidate: `(user_id, source_name, source_record_id)` when source IDs exist.

`food_logs`

Manual fallback/correction intake only. This is not the Planning Database and should not become the primary V1 food-tracking workflow.

- `id uuid primary key`
- `user_id uuid references users(id)`
- `log_date date not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- Unique index: `(user_id, log_date)`.

`food_entries`

Manual fallback/correction intake only. Confirmed bank calculations should prefer synchronized imported intake from connected calorie-tracking sources.

- `id uuid primary key`
- `food_log_id uuid references food_logs(id)`
- `user_id uuid references users(id)`
- `name text not null`
- `calories integer not null check (calories >= 0)`
- `protein_g numeric not null default 0`
- `carbs_g numeric not null default 0`
- `fat_g numeric not null default 0`
- `source text not null default 'manual'`
- `logged_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

`activity_entries`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `log_date date not null`
- `activity_type text not null`
- `calories integer not null check (calories >= 0)`
- `source text not null default 'manual'`
- `external_source_id text`
- `logged_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

`planning_items`

Planning-only meal, food, drink, product, restaurant item, or event estimate. Planning items do not directly affect bank calculations.

- `id uuid primary key`
- `user_id uuid references users(id)` nullable for provider-sourced items
- `name text not null`
- `item_type text not null` (`restaurant_item`, `fast_food_item`, `grocery_product`, `packaged_snack`, `drink`, `dessert`, `homemade_meal`, `custom_meal`, `event`)
- `estimated_calories integer not null check (estimated_calories >= 0)`
- `nutrition_source_type text not null` (`official`, `manufacturer`, `restaurant_published`, `user_estimated`, `unknown`)
- `provider text`
- `provider_item_id text`
- `is_user_created boolean not null default false`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`planned_meals`

Saved future planning records. These are not consumed-meal logs.

- `id uuid primary key`
- `user_id uuid references users(id)`
- `planning_item_id uuid references planning_items(id)`
- `planned_for date`
- `estimated_calories integer not null check (estimated_calories >= 0)`
- `status text not null` (`planned`, `saved`, `archived`)
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`finalized_daily_bank_records`

Implemented V1 read-model table for one completed day. This is currently populated only by a guarded development seed/finalization script until real integrations and day-finalization jobs exist.

- `id uuid primary key`
- `user_id uuid references users(id)`
- `log_date date not null`
- `timezone text not null`
- `imported_total_daily_expenditure integer not null`
- `expenditure_adjustment_rate numeric not null`
- `adjusted_expenditure integer not null`
- `goal_mode text not null` (`cut`, `maintain`, `bulk`)
- `goal_adjustment_calories integer not null`
- `imported_calorie_intake integer not null`
- `daily_allowance integer not null`
- `daily_bank_change integer not null`
- `finalized_at timestamptz not null`
- `created_at timestamptz not null`
- Unique index: `(user_id, log_date)`.

`calorie_ledger_transactions`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `log_date date not null`
- `type text not null` (`daily_finalization`, `adjustment`)
- `amount_calories integer not null`
- `source_type text not null` (`finalized_daily_bank_record`, `manual_adjustment`)
- `source_id uuid not null`
- `idempotency_key text not null`
- `description text not null`
- `created_at timestamptz not null`
- Unique index: `(user_id, idempotency_key)`.

Ledger convention:

- Positive amount means calories deposited into the bank.
- Negative amount means calories withdrawn from the bank.
- Official all-time bank is `sum(amount_calories)` across finalized daily ledger transactions. Filtered history ranges may show a separate range net change but must not replace the all-time bank.
- Imported intake, imported total expenditure, manual corrections, target snapshots, historical initialization, and reconciliation records may produce ledger transactions under `docs/product/bank-calculation-spec.md`.
- Planning Database items and planned meals are advisory and must not produce calorie ledger transactions.
- Planned Treat records store one active user-selected food, meal, treat, or event goal. They must not duplicate the Available Bank; progress is derived from the same all-time ledger sum used by Bank Summary.
- The V1 calculation policy is `v1-total-expenditure-80`; implementation must keep the calculation transparent, source-labeled, versioned, and auditable.
- Adjusted expenditure is rounded deterministically to the nearest integer calorie after applying the expenditure adjustment rate.
- Finalized daily record creation and ledger transaction creation must happen in one database transaction.
- The user-facing bank model distinguishes Available Bank, optional Emergency Bank, and Recovery Forecast. Negative daily changes apply in the order Available Bank -> Emergency Bank -> Recovery Forecast.
- Emergency Bank allocation and coverage must be traceable through the ledger or an equivalently auditable model; do not implement it as hidden mutable state.

Future tables:

- `record_reconciliations`
- `food_entry_photos`
- `favorite_foods`
- `favorite_activities`
- `health_connections`
- `health_import_batches`
- `planning_data_providers`
- `beta_invites`
- `sessions` or `refresh_tokens`
- `notification_preferences`
- `notification_deliveries`
- `saved_items`
- `reserve_policies`
- `bank_balance_allocations`

## 10. Phased Migration Plan

### Phase 0: Preserve Prototype and Lock Scope

- Keep current code running as reference.
- Treat `docs/product/v1-prd.md` as the authoritative V1 scope.
- Add this audit update and the connection-first decision record.
- Confirm whether secrets were ever committed or shared; rotate if uncertain.
- Decide whether `legacy/` should hold the current web/API code or whether V1 will replace folders in place.

### Phase 1: Monorepo Foundation

- Add root package/workspace tooling.
- Create `apps/mobile`, `apps/api`, and `packages/*`.
- Add TypeScript, linting, formatting, test runner, and environment validation.
- Add API health check and structured error format.

### Phase 2: PostgreSQL, Auth, and Integration Foundation

- Add PostgreSQL client/ORM and migrations.
- Implement users, sessions/tokens, profiles, and goal-adjustment snapshots.
- Implement integration connection state, authorization metadata, sync batches, imported record tables, and duplicate-prevention keys.
- Add password hashing, rate limiting, request validation, and auth tests.
- Create a private-beta invite or allowlist mechanism if needed.

### Phase 3: Smallest Credible Automatic Banking Loop

- Implement connection-first onboarding for one feasible intake source path and one feasible expenditure/health source path.
- Implement data synchronization, imported record storage, source labeling, and sync status.
- Implement automatic bank calculation from `docs/product/bank-calculation-spec.md` with explicit pending/incomplete/confirmed/corrected states.
- Implement immutable ledger transaction creation for daily changes and adjustments.
- Implement Planning Database storage/search for future meal and event estimates without connecting planning estimates to bank ledger inputs.
- Implement one active Planned Treat that compares required calories against the all-time Available Bank without creating ledger transactions or automatic withdrawals.
- Build Expo screens for onboarding, connections, bank-first home with all-time Available Bank, optional Emergency Bank state, Recovery Forecast when applicable, planning search/detail, Bank History with finalized-day ranges, selected-day detail, notification settings, and manual correction/fallback.

### Phase 4: Migration and Compatibility

- Write one-off migration scripts from MongoDB to PostgreSQL if existing prototype user data matters.
- Map `User` documents to `users`, `user_profiles`, and goal-adjustment snapshots where enough information exists. Legacy absolute target values must not be treated as approved V1 configuration without a migration decision.
- Map `FoodLog.entries` to `food_logs` and `food_entries`.
- Map `burnedActivities` to `activity_entries`.
- Convert historic `bankBalance` into either recomputed ledger transactions or a one-time opening balance adjustment.
- Keep migrated manual data labeled as manual/prototype-origin data.

### Phase 5: Beta Readiness

- Add observability, error tracking, backups, rate limits, privacy policy support, account deletion, and support tooling.
- Add seed/sandbox data and end-to-end tests for connection-first onboarding, sync, ledger calculation, notification generation, and explanation history.
- Add TestFlight build pipeline and beta environment separation.

### Phase 6: Integrations

- Expand from the smallest technically credible integration path only after the first path proves the automatic banking thesis.
- Investigate Apple Health/HealthKit, Android Health Connect, supported direct APIs, user-authorized imports, and manual fallback without claiming unsupported third-party API access.
- Add USDA FoodData Central, restaurant/packaged-food data, or food photos only if they support a validated planning or fallback/correction use case. Do not claim unsupported provider access.

## 11. Smallest First Vertical Slice

The smallest V1 vertical slice should be:

1. Register or sign in.
2. Confirm timezone, goal mode, and the signed daily energy adjustment when applicable.
3. Connect one technically feasible intake-data source path, even if sandbox/mock/user-authorized import is required for alpha.
4. Connect one technically feasible expenditure/health-data source path.
5. Sync recent data with source labels, sync batches, and duplicate-prevention keys.
6. Initialize lifetime bank from up to 7 days of available supported history, starting at zero if the calculated value is zero/negative or data is incomplete.
7. Calculate a daily bank update using `v1-total-expenditure-80` into immutable ledger transactions with confirmed/pending/incomplete/corrected states.
8. Show all-time Available Bank, optional Emergency Bank status when enabled, Recovery Forecast when applicable, Bank History ranges, and selected-day calculation detail.
9. Search or create a Planning Database entry and compare its estimated calories against Available Bank without changing the ledger.
10. Generate the morning bank-update notification payload.

Defer for this slice:

- Macros.
- Photos.
- Broad Apple Health behavior beyond the selected feasible expenditure/health path.
- Broad nutrition-provider coverage beyond the selected Planning Database path.
- Full treat planning beyond naming one saved food/meal/event if needed for the notification.
- Weekly charts not required for explanation.
- Broad activity import.
- Complex onboarding/TDEE estimation.
- Full manual food logger.

This slice proves the hardest V1 architectural decisions: mobile auth, integration authorization/sync, PostgreSQL persistence, typed API, date ownership, notification generation, source-labeled history, and transactional calorie ledger.

## 12. Blocking Questions

These questions genuinely affect implementation choices:

1. Which intake-data source is genuinely feasible for the first 10 users?
2. Which expenditure/health-data source is genuinely feasible for the first 10 users?
3. Is HealthKit sufficient as an initial aggregation layer, or is a separate intake path required?
4. Should V1 use password auth, Sign in with Apple, or both for the private beta?
5. Which source can provide imported total daily expenditure for the first 10 users?
6. How should active, resting, total, and unknown expenditure classifications be stored and displayed when source data contains multiple types?
7. What fallback should be used when only intake or only expenditure data is available?
8. How long should the system wait after midnight before marking a day's data incomplete?
9. What timezone change behavior is allowed after onboarding?
10. Does existing MongoDB production data need to be migrated, or can V1 start with fresh beta data?
11. What minimum privacy/security bar is required before inviting beta users, especially around health-adjacent data?
12. How should Emergency Bank historical initialization, allocation-rate range, rounding, target behavior, and disable behavior work?
13. Which Planning Database provider path is feasible for restaurant meals, grocery products, packaged foods, homemade meals, and user-created planning entries?
14. Can planning entries later be exported into supported calorie-tracking applications, or do users always log consumed meals directly in their tracker?
