# CalorieBank Current-State Architecture Audit

Date: 2026-07-16

## 2026-07-16 Direction Update

The original audit was written when V1 was assumed to be manual-food-logging-first. That assumption is superseded.

The authoritative V1 direction is now connection-first automatic calorie banking: users connect supported calorie-intake and calorie-expenditure/health data sources, configure goal mode and a deficit/surplus adjustment when applicable, receive automatic bank calculations, and get one meaningful morning bank update. Manual food logging remains useful prototype work, but for first-10-user V1 it is fallback/correction/supplementary behavior rather than the promoted product loop.

V1 also includes a Planning Database for future meal and event estimates. That database is planning-only: connected calorie-tracking applications remain the source of truth for Food Tracking, daily intake, historical intake, synchronization, and bank calculations. Planning Database estimates must not directly update the bank.

The approved mobile information architecture is bank-first. The initial experience shows the all-time Available Bank first, the latest finalized contribution, concise calculation access, and required data status. It does not require every implemented V1 capability to be visible immediately. Foreground Apple Health sync refreshes intake and activity context for current day plus the prior two local dates. Google Health API v4 is now the server-side transport for the first dedicated Fitbit-derived expenditure adapter. Explicit provider selection resolves one authoritative expenditure record and one authoritative intake record; provider totals are never summed. Scheduler-neutral orchestration delegates posting, reconciliation, and locking to the banking engine. Completed days affect Available Bank immediately as provisional, reconcile through append-only correction transactions for two local calendar days, and then lock.

The current architecture inventory below remains valid as a description of the existing prototype. Forward-looking reuse, migration, database, and vertical-slice guidance has been updated to match `docs/product/v1-prd.md`. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`; the rejection of absolute user-entered daily calorie targets is recorded in ADR 002. Provider-neutral ingestion is governed by ADR 006, Apple Health and the development-build boundary by ADR 007, activity context by ADR 008, provisional reconciliation by ADR 009, reliable rolling synchronization/orchestration by ADR 010, Progressive Feature Discovery by ADR 011, Today's Eating Budget by ADR 012, Banking Goals by ADR 013, Progressive Familiarity by ADR 014, Time-Aware Activity Forecasting by ADR 015, authoritative provider resolution plus Fitbit by ADR 016, multi-provider wearable qualification by ADR 017, and direct nutrition providers plus FatSecret by ADR 018.

ADR 016 adds `provider_selections`, encrypted server-side Google OAuth connections, and normalized Fitbit-derived expenditure, steps, and exercise sessions under `google_health_fitbit`. Provider roles separately resolve expenditure, activity context, and intake. Today uses Google Health/Fitbit for Burned, Steps, and Workouts when selected, while Apple Health remains intake. No step summation or workout merging occurs. Apple Health fallback requires explicit policy. Selection changes can reconcile provisional days only when a banking input changes; locked QA history is retained.

The legacy Fitbit Web API transport has been removed before physical-device Fitbit QA. Google Health API v4 `total-calories:dailyRollUp` is the production path; it supplies basal-plus-active total expenditure once, after which CalorieBank applies `0.80` once.

For Fitbit-derived expenditure, the official Google Health `total-calories` daily rollup is authoritative. A Google/Fitbit consumer application may temporarily or persistently display a different provider-side value; CalorieBank does not manufacture parity by adding workouts or estimates. While a date remains provisional, normal rolling synchronization can import a changed official value and the existing append-only reconciliation handles the difference. Local development Health Diagnostics includes a read-only Burn Parity comparison of the live rollup, normalized value, persisted aggregate, and latest calculation snapshot.

ADR 017 expands the capability registry to Garmin and WHOOP without weakening provider qualification. Apple Health is `DERIVABLE_TOTAL` only from Active plus Resting Energy; Fitbit is `FULL_TOTAL`; Garmin expenditure is `UNAVAILABLE` until approved-program documentation verifies daily-calorie semantics; WHOOP is `UNAVAILABLE` for local-day expenditure and has no verified steps capability. The dormant WHOOP server adapter and generic encrypted external-provider tables remain for future evaluation, but WHOOP and Garmin are excluded from the V1 mobile connection surface. No current V1 flow advertises or selects them.

ADR 018 extends the same generic external-provider persistence to OAuth 1.0 delegated token secrets and short-lived request-token state. FatSecret is the first direct intake adapter. It fetches the official monthly diary summary, normalizes only daily calories, marks omitted dates unavailable, and uses the existing three-day sync and reconciliation callback. Apple Health remains the intake bridge. Today and completed-day accounting resolve one selected usable intake record without summation. On 2026-08-18, the FatSecret delegated OAuth flow completed successfully on a physical iPhone development build and returned to CalorieBank as `Connected · Available`; broader production validation remains outstanding.

ADR 022 closes the Apple Health bridge's multi-writer authority gap. Physical iPhone diagnostics confirmed that the all-source Dietary Energy statistic summed Cronometer and FatSecret, while raw, separate-by-source, and source-filtered totals agreed for each observed writer. The mobile client now discovers writers, selects one stable `source.bundleIdentifier`, queries only that source, and uploads the normalized daily total with minimal writer provenance. The API rejects mismatched writer uploads and excludes legacy all-writer Apple aggregates. Existing users with one usable writer can adopt it automatically; multiple writers require an explicit selection. Locked and Opening Bank history remain immutable.

ADR 019 replaces shared request identity with a Clerk-verified beta boundary. A unique external subject maps to one internal UUID `User`; an unseen verified subject provisions a fresh internal user, never an email match, shared development user, or arbitrary existing account. All `/v1/me/*` access and Apple Health ingestion derive ownership from that verified user. Google Health and FatSecret callback ownership remains server-side through expiring, single-use attempts. `DEV_USER_ID` is local-only; a development-auth API rejects Clerk bearer credentials, while beta/production configuration fails closed and requires Clerk plus HTTPS-separated infrastructure.

ADR 020 adds a one-time Opening Bank boundary for newly authenticated users and a truthful Recovery read model for every user. Existing users retain their exact ledger sum. New users complete a deliberate full-window attempt for both selected roles before eligible prior-seven-local-day data may become immutable opening snapshots. A completed attempt with no matching history records the future accounting boundary while Available Bank remains uncalculated; the first later completed day posts normally. The effective balance equals Opening Bank plus subsequent ledger transactions. Consumer Available Bank is clamped at zero only in the read model; the negative portion is exposed as Recovery.

Fresh onboarding distinguishes connection from usable selected-role readiness. `/v1/me/onboarding` derives preparation from goal existence, completed full-window sync-session provenance, and Opening Bank state; a connected credential alone cannot advance a required role.

The mobile app now implements the connection-first P1 journey. `/v1/me/onboarding` derives progress from authenticated provider selection/connection state, goal existence, and Opening Bank status, with only welcome and completion acknowledgement persisted on `UserProfile`. Existing profiles are forward-migrated as complete; new profiles resume at the earliest unmet stage. The functional Bank History implementation is the History tab and uses a unified consumer read model for immutable Opening Bank calculation dates and normal finalized dates without converting opening snapshots into ledger records. Settings exposes only Goal, Health Connections, Customize Today, and Sign Out. Health Connections is role-first: Calories Burned and Calories Eaten cards show current authority and open compact Change/Add Source flows, while separate Burn Sources and Intake Sources inventories expose role-specific connected options, safe direct-provider removal, and Apple Health management. `GET /v1/me/health-connections` separates role selection, connected alternatives, selected-but-unavailable state, and add-source capability using consumer-safe opaque options. Role-specific mutations preserve the inactive Apple Health writer and route through existing global reconciliation. Successful role mutations and disconnects update local state before best-effort revalidation, so a later refresh failure cannot misreport a committed operation. Selected Fitbit/FatSecret disconnects are rejected until authority is explicitly changed; unselected disconnects preserve historical data. Apple Health permission truth remains device-local and is composed into the mobile presentation.

ADR 011 separates V1 availability from first-use visibility. It supersedes architecture guidance that assumes all supporting Today cards must be shown by default. Feature discovery state, recommendation thresholds, and persistence remain conceptual; no speculative recommendation or machine-learning schema is approved.

ADR 014 extends that policy: proactive discovery requires independent Relevance, Familiarity, and Complementarity gates. Familiarity is based on meaningful interaction with existing concepts, not account age, elapsed days, session count alone, or arbitrary timers. When multiple capabilities qualify, the product recommends the one with the highest immediate value and delays the others. ADR 014 does not approve a familiarity-scoring algorithm, persistence schema, or recommendation engine, and it does not block manual navigation.

ADR 012 adds Today's Eating Budget as progressively discovered V1 guidance. The current Apple Health adapter provides cumulative active plus basal energy for the local-day window and the API provides confirmed intake so far, but the repository has no approved remaining-expenditure model or separate desired-bank-contribution field. A numeric budget is therefore architecture-planned but implementation-blocked; no speculative schema or API is approved.

ADR 013 adds Banking Goals as a post-foundation V1 Planning capability. Banking Goals organize portions of one Available Bank into user-created goal allocations and Unassigned calories; they do not create independent balances or a second ledger. The current one-active-Planned-Treat implementation remains unchanged. Production Banking Goals work is blocked until protection semantics, withdrawal allocation, Emergency Bank ordering, and correction routing are approved.

ADR 015 adds an advanced layer within Today's Forecast. The current ingestion architecture supplies cumulative active-plus-basal expenditure, steps, normalized workouts, source timestamps, and local-calendar dates, but it does not provide an approved hourly baseline model, familiar-activity recognition policy, burn-target contract, forecast-confidence method, or active-day boundary. Time-aware numerical guidance is therefore architecture-planned but implementation-blocked. Forecast confidence and user familiarity remain independent readiness gates.

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

Implemented report table for one completed day. Provider expenditure/intake aggregate changes can now post or reconcile the report automatically; the development seed remains available for deterministic local history.

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
- `original_daily_bank_change integer not null`
- `effective_daily_bank_change integer not null`
- `status text not null` (`PROVISIONAL`, `LOCKED`; persisted `OPEN` is prohibited)
- `correction_count integer not null`
- `current_version integer not null`
- `lock_at timestamptz not null`
- `locked_at timestamptz nullable`
- `locked_by_sync_session_id uuid nullable`
- `finalized_at timestamptz not null`
- `created_at timestamptz not null`
- Unique index: `(user_id, log_date)`.

`bank_calculation_snapshots`

Append-only calculation versions. Each version preserves provider records, trigger sync session, raw and adjusted expenditure, intake, goal snapshot, allowance, expected contribution, correction delta, reason, and input fingerprint. Unique report/version and report/fingerprint constraints prevent duplicate versions.

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
- `calculation_snapshot_id uuid nullable unique`
- Unique index: `(user_id, idempotency_key)`.

Ledger convention:

- Positive amount means calories deposited into the bank.
- Negative amount means the completed day automatically reduced the bank. The finalized daily transaction is the withdrawal; V1 must not add a separate manual `Use Bank` or treat-withdrawal action.
- Official all-time bank is `sum(amount_calories)` across initial and correction ledger transactions. A day's effective contribution is its original posting plus all correction deltas. Filtered history ranges may show a separate range net change but must not replace the all-time bank.
- Imported intake, imported total expenditure, manual corrections, target snapshots, historical initialization, and reconciliation records may produce ledger transactions under `docs/product/bank-calculation-spec.md`.
- Planning Database items and planned meals are advisory and must not produce calorie ledger transactions.
- Planned Treat records store one active user-selected food, meal, treat, or event goal. They must not duplicate the Available Bank; progress is derived from the non-negative Available Bank read model and is zero while the effective balance is in Recovery.
- Future Banking Goal records organize finalized Available Bank calories only. They must preserve `active goal allocations + Unassigned = Available Bank`, exclude Emergency Bank by default, and never duplicate ledger deposits.
- Banking Goal allocation events may provide traceability for routing, overflow, releases, and usage attribution, but the calorie ledger remains authoritative. Goal operations do not independently change Available Bank.
- The V1 calculation policy is `v1-total-expenditure-80`; implementation must keep the calculation transparent, source-labeled, versioned, and auditable.
- Adjusted expenditure is rounded deterministically to the nearest integer calorie after applying the expenditure adjustment rate.
- Initial posting and each correction snapshot/ledger pair happen transactionally. PostgreSQL advisory transaction locks serialize work for one user/date; idempotency and uniqueness constraints prevent duplicate posting and corrections.
- The implemented user-facing bank model derives non-negative Available Bank and Recovery from one effective balance. Recovery is not another ledger. Emergency Bank remains an optional deferred capability and is not automatically surfaced when Recovery begins.
- Emergency Bank allocation and coverage must be traceable through the ledger or an equivalently auditable model; do not implement it as hidden mutable state.
- Emergency Bank visibility is a user preference. Hiding the Today card must not change reserve balance or rules.

Implemented current-day source-attributed ingestion records:

- Expenditure daily aggregate: user ID, log date, source, external source ID, total daily expenditure, imported time, source updated time, sync batch ID, timezone, current-day flag, and deduplication identity.
- Intake daily aggregate: user ID, log date, source, external source ID, total daily calorie intake, imported time, source updated time, sync batch ID, timezone, and deduplication identity.
- Today so far awareness read model: local date, timezone, adjusted expenditure calories, raw imported expenditure calories, expenditure adjustment rate, expenditure source, expenditure last synced time, imported calorie intake, intake source, intake last synced time, data freshness status, and partial/current-day flags.
- Prefer daily aggregate imports when providers expose daily aggregate totals. Do not double-count active calories on top of total daily expenditure.
- Provisional posting consumes source-attributed daily intake and total-expenditure aggregates, preserves `v1-total-expenditure-80`, and changes Available Bank immediately. Changed banking aggregates reconcile for two local calendar days through immutable versions and delta transactions. Steps and workouts remain awareness-only.
- Implemented provider-neutral ingestion foundation: shared domain interfaces `ExpenditureProvider` and `IntakeProvider`, normalized daily aggregate models, persistent aggregate tables, read-only `GET /v1/me/today`, and validated device-ingestion commands.
- Implemented activity-context abstractions: `StepProvider` and `WorkoutProvider`, cumulative step aggregates, normalized current-day workouts, stable provider workout identity, and independent Today states.
- Implemented first real adapter: Apple Health queries active energy, basal energy, dietary energy, steps, and workouts on the iOS device. The app uses an Expo development client because HealthKit cannot run in Expo Go.
- Current Apple Health synchronization is foreground-only and coordinated through durable lightweight sync sessions. It queries current day, yesterday, and the day before independently, skips accepted unchanged values, and retains failed uploads in an ordered device outbox. Newer cumulative daily totals replace older totals; stale snapshots are ignored; workout snapshots remove provider workouts no longer present for that date; partial category failures remain visible; current-day ingestion never writes the finalized ledger.
- Implemented finalization orchestration records queried/uploaded/skipped/reconciled/locked/waiting dates and delegates all accounting to the existing provisional pipeline. Durable day states distinguish missing intake, missing expenditure, unavailable provider, missing sync, and other missing required inputs. A schedulable CLI uses the same service as sync-session completion.
- Dashboard visibility preferences are account-level. Available Bank is always first and cannot be hidden. The implemented shell may still default several supporting cards to visible, but that implementation state is not the governing product default: ADRs 011 and 014 require a focused Foundation experience, manual discoverability, and three-gate pacing for proactive introductions. Hiding a card does not disable ingestion.
- Development adapters remain test or explicit local fallback. Device and production modes exclude synthetic provider rows.

Implemented aggregate tables:

`daily_expenditure_aggregates`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `local_date date not null`
- `timezone text not null`
- `provider text not null`
- `provider_record_id text not null`
- `raw_total_daily_expenditure integer not null`
- `adjusted_daily_expenditure integer not null`
- `adjustment_factor numeric not null`
- `imported_at timestamptz not null`
- `provider_updated_at timestamptz`
- `sync_status text/enum not null`
- `is_current_day boolean not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- Unique provider record index: `(user_id, provider, provider_record_id)`.

`daily_intake_aggregates`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `local_date date not null`
- `timezone text not null`
- `provider text not null`
- `provider_record_id text not null`
- `total_calories_consumed integer not null`
- `imported_at timestamptz not null`
- `provider_updated_at timestamptz`
- `sync_status text/enum not null`
- `is_current_day boolean not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- Unique provider record index: `(user_id, provider, provider_record_id)`.

The aggregate tables are not the immutable calorie ledger. Current-day values remain awareness-only. Once a local day completes and both banking aggregates exist, the implemented provisional pipeline may consume them to create an immediate posting and later correction deltas.

ADR 024 adds role-specific historical authority for provisional completed days. Exact-date persisted source options are resolved through one override-first authority resolver shared by user changes and later provider reconciliation. The override is user intent; immutable calculation snapshots and append-only correction transactions remain the accounting record. Locked, Opening Bank, current, and future dates cannot be changed. Multiple Apple Health intake writers on one date remain deferred.

Future Activity Opportunity Engine records:

- Activity preferences: user ID, selected activity codes/categories, preferred durations, preferred days or time windows, muted activities, activity-nudge opt-in, maximum nudges per week, quiet hours, created and updated timestamps.
- Activity catalogue: activity code, consumer name, category, intensity level, supported durations, estimation method, low/high intensity coefficients, model version, source reference, and active flag.
- Activity opportunity candidate: opportunity ID, user ID, Planned Treat ID, activity code/display name, duration, estimated low/high calories, estimation method/model version, remaining treat calories, planned treat date/time, reason codes, score, generated/expiration timestamps, notification category, delivery eligibility, blocked reason, and deduplication key.
- Notification delivery history: user ID, opportunity ID, notification category, activity code, scheduled/delivered/opened/dismissed timestamps, delivery status, suppression reason, deduplication key, and template version.
- Estimated activity calories are planning estimates only. They must not be stored in `calorie_ledger_transactions`, must not change Available Bank, and must not replace connected-source expenditure.

Future Banking Goals architecture, pending ADR 013's blocking decisions:

- Goal definition: user, name, optional target, optional date/note, priority, allocation method, status, optional planning-item reference, and lifecycle timestamps.
- Allocation event: goal, amount, event kind, source finalized contribution or correction when applicable, allocation-policy version, prior/resulting goal allocation, prior/resulting Unassigned amount, and idempotency identity.
- Allocation events are planning records, not calorie ledger transactions.
- Read models must derive or validate total goal allocations and Unassigned against the authoritative Available Bank.
- No table or API should be implemented until finalized-withdrawal reduction and correction routing can guarantee conservation under concurrency.

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
- `activity_preferences`
- `activity_catalogue_items`
- `activity_opportunity_candidates`
- `saved_items`
- `reserve_policies`
- `bank_balance_allocations`
- `banking_goals`
- `banking_goal_allocation_events`

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

- Validate the implemented connection-first onboarding end to end with new beta identities across Fitbit/FatSecret and Apple Health paths, including OAuth interruption, missing dietary data, and Opening Bank waiting states.
- Validate the implemented rolling three-day Apple Health query and offline outbox on a physical device. Keep provider-specific payload translation inside adapters.
- Render private beta runs the host-agnostic account lifecycle coordinator hourly. It refreshes authoritative server-readable Fitbit/FatSecret sources, isolates failures per user, and invokes the existing idempotent posting, reconciliation, retry, continuity, and locking pipeline. Apple Health remains device-only and performs bounded foreground catch-up from authenticated app scope.
- Implement Planning Database storage/search for future meal and event estimates without connecting planning estimates to bank ledger inputs.
- Implement one active Planned Treat that compares required calories against the all-time Available Bank without creating ledger transactions. Negative completed days handle bank reduction through finalized daily ledger transactions.
- Continue focused beta polish around the implemented onboarding, job-oriented connections, bank-first Today, and real History tab. Later V1 planning, forecast, notification, and recovery-guidance surfaces remain governed by their specific decisions and progressive visibility rules.
- Preserve these capabilities as V1 scope without placing all of them in onboarding or the initial Today surface. Foundation-stage visibility should prioritize Available Bank, latest finalized contribution, explanation, and required data status. Subsequent proactive introductions must pass Relevance, Familiarity, and Complementarity and should not stack multiple new concepts.
- Keep Today's Forecast and Projected Daily Burn in V1 planning, but do not implement or introduce them until sufficient-history, estimation, labeling, and discovery decisions are approved. Time-Aware Activity Forecasting remains a deeper layer inside that feature and additionally requires approved remaining-time, baseline, confidence, target, freshness, overlap, and day-boundary policies. Both system confidence and user readiness must pass before proactive introduction. Forecasts must never project the bank.
- Keep Today's Eating Budget in V1 planning, but do not implement a numeric read model until provider intra-day semantics, remaining-resting-expenditure methodology, signed-goal mapping, rounding, correction, and stale-data rules are approved. It must remain outside the ledger.
- Keep Banking Goals in the post-foundation V1 Planning roadmap, but do not implement schema or APIs until soft-versus-protected allocation, negative-change reduction, Emergency Bank ordering, correction routing, and policy versioning are approved. Preserve the existing one-active-Planned-Treat behavior meanwhile.

### Phase 4: Migration and Compatibility

- Write one-off migration scripts from MongoDB to PostgreSQL if existing prototype user data matters.
- Map `User` documents to `users`, `user_profiles`, and goal-adjustment snapshots where enough information exists. Legacy absolute target values must not be treated as approved V1 configuration without a migration decision.
- Map `FoodLog.entries` to `food_logs` and `food_entries`.
- Map `burnedActivities` to `activity_entries`.
- Convert historic `bankBalance` into either recomputed ledger transactions or a one-time opening balance adjustment.
- Keep migrated manual data labeled as manual/prototype-origin data.

### Phase 5: Beta Readiness

- PB.1 is complete. PB.2 is **Private Beta Readiness & Account Safety** and covers observability/redaction, private-beta rate limits, account deletion, backup/restore operations, support-safe diagnostics, regression coverage, and distribution readiness. Morning Bank Update follows PB.2.
- Add observability, error tracking, backups, rate limits, privacy policy support, account deletion, and support tooling.
- Add seed/sandbox data and end-to-end tests for connection-first onboarding, sync, ledger calculation, notification generation, and explanation history.
- Validate initial-experience simplicity, manual feature discoverability, dismissal behavior, and the difference between Projected Daily Burn and a prohibited Projected Bank.
- Validate the two independent Time-Aware Activity Forecasting readiness gates, approximate checkpoint comprehension, confirmed-versus-hypothetical separation, stale-data fallback, and the ability to remain on the simpler forecast.
- Validate that Today's Eating Budget is distinguishable from Available Bank, Remaining Today is clearly labeled, and confirmed versus estimated inputs remain understandable.
- Validate that Banking Goals are understood as allocations within one Available Bank, Unassigned remains clear, overflow is predictable, and Ready is not mistaken for consumed or withdrawn.
- Add TestFlight build pipeline and beta environment separation.

### Phase 6: Integrations

- Expand from the smallest technically credible integration path only after the first path proves the automatic banking thesis.
- Investigate Apple Health/HealthKit, Android Health Connect, supported direct APIs, user-authorized imports, and manual fallback without claiming unsupported third-party API access.
- Add USDA FoodData Central, restaurant/packaged-food data, or food photos only if they support a validated planning or fallback/correction use case. Do not claim unsupported provider access.

### Phase 7: Activity Opportunity Engine

- Before production opportunity recommendations, establish a provider-neutral historical-pattern read model and approve the deterministic basic Projected Daily Burn and Forecast Confidence contracts. Time-aware pace guidance follows only after ADR 015's remaining-time and safety blockers are resolved.
- Implement only after real source-attributed intake and expenditure ingestion, Today-so-far awareness, notification permission, stable Planned Treat timing, and explicit activity preference collection exist.
- Start with a curated, versioned population-based activity-energy catalogue and deterministic estimate service.
- Add wearable-personalized estimates only after enough consented activity history exists.
- Keep candidate generation separate from push delivery.
- Add fatigue controls, quiet hours, duplicate suppression, and notification delivery history before sending production activity opportunities.
- Do not use AI to invent calorie ranges or override policy validation.

## 11. Smallest First Vertical Slice

The smallest V1 vertical slice should be:

1. Register or sign in.
2. Confirm timezone, goal mode, and the signed daily energy adjustment when applicable.
3. Connect one technically feasible intake-data source path, even if sandbox/mock/user-authorized import is required for alpha.
4. Connect one technically feasible expenditure/health-data source path.
5. Sync recent data with source labels, sync batches, and duplicate-prevention keys.
6. Initialize lifetime bank from up to 7 days of available supported history, starting at zero if the calculated value is zero/negative or data is incomplete.
7. Calculate a daily bank update using `v1-total-expenditure-80` into immutable ledger transactions with confirmed/pending/incomplete/corrected states.
8. Show the Foundation-stage experience: all-time Available Bank, latest finalized contribution, concise calculation access, and required data status. Keep other implemented V1 capabilities manually accessible or eligible for later discovery under ADR 014's Relevance, Familiarity, and Complementarity gates; activate Recovery Forecast immediately when context requires it.
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
- Activity Opportunity Engine, personalized activity nudges, activity catalogue, notification fatigue controls, and wearable-personalized estimates.
- Complex onboarding/TDEE estimation.
- Full manual food logger.

This slice proves the hardest V1 architectural decisions: mobile auth, integration authorization/sync, PostgreSQL persistence, typed API, date ownership, notification generation, source-labeled history, and transactional calorie ledger.

Implemented in A1 under ADR 021: **Steps Intelligence** uses the latest up to five paired, provider-reported walking/running workout step and active-calorie records to estimate a personal step contribution. One valid workout is sufficient. Google Health performs a bounded workout-only search of up to 30 days so pre-CalorieBank history can calibrate immediately, then newer workouts improve the estimate. It never derives a rate from total daily expenditure and remains ledger-neutral. An unset fresh-user Steps preference is separately inferred once after at least three completed authoritative step days exist; an average of 10,000 or more shows the card, while an explicit user preference always wins. The current Apple Health adapter does not supply workout steps, so Apple Health estimates remain unavailable rather than using a weak fallback.

Implemented in A2: **Progressive Detail** makes Steps and Today so far tappable without adding more default Today cards. A2.2 Steps Detail reuses the A1 personal walk/run rate and A2.1 projected provider burn at rest. Its forward calculator adds only calories from steps above the current count; its inverse converts a desired estimated-actual burn to the equivalent provider burn and solves that same provider-based model for total steps. Inputs are transient and both directions are read-only and ledger-neutral. Provider and underlying intake-writer labels remain dynamic.

The consumer hierarchy places Available Bank and any Recovery state first, followed by the latest completed contribution, Current Goal, Today So Far, Planned Treat, Steps, and Logged Workouts when those optional cards are visible. Steps Detail presents `If I want to burn…` before `If I walk…`; this ordering changes presentation only.

A2.1 replaces the post-ingestion-only resting fallback with a persisted, historical-first model under ADR 023. Apple Health computes a daily Basal Energy model on-device without uploading samples. Google Health computes a median from official hourly total-calorie/step rollups after excluding active and workout-overlap hours. The model stores only derived provenance and is user-owned. Today Detail exposes projected provider burn, projected `× 0.80` estimated actual burn, and resting kcal/hour. Remaining local-day time is used internally by the forecast but is not displayed.

The A2.1 correction removed an invalid optional `pageSize` from Google Health hourly `total-calories` rollups, accepts three credible resting observations, and preserves progressive 14/30/90-day pre-signup lookback. Safe development diagnostics identify missing hourly calories, steps, qualifying intervals, or remote request failure. `Why 80%?` is an in-place Today modal with the founder calibration story rather than a navigation route.

The final A2.1 correction decouples resting-model resolution from Fitbit accounting synchronization. The Today route resolves a missing or stale Fitbit prediction cache before building its read model and returns that forecast immediately; the resolver performs no accounting ingestion. Development diagnostics report model resolution, forecast inputs/results, API response presence, and mobile receipt presence.

### Deferred Samsung / Galaxy Watch path

The provider-neutral architecture could later support `Galaxy Watch / Samsung Health -> Health Connect -> CalorieBank` through a dedicated Android device adapter. Android Health Connect defines `TotalCaloriesBurnedRecord` as total energy including active and basal energy and exposes `ENERGY_TOTAL` aggregation with `READ_TOTAL_CALORIES_BURNED`. A future adapter would require Android Health Connect permissions, local-day aggregation, source metadata and freshness handling, rolling synchronization, normalized provider records, capability registration, authoritative-role selection, and physical Galaxy Watch QA. CalorieBank would then apply its existing `0.80` adjustment once.

This is not yet an approved provider. Current official Health Connect documentation establishes the record semantics, but the audit did not find authoritative Samsung documentation proving that Samsung Health currently exports a complete, reliable Galaxy Watch total into `TotalCaloriesBurnedRecord`. Implementation therefore remains blocked on Samsung-specific export verification, duplicate/source behavior testing, and an Android native build. Active calories, workout calories, or steps alone would not qualify.

References: [Health Connect aggregate data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data), [TotalCaloriesBurnedRecord](https://developer.android.com/reference/androidx/health/connect/client/records/TotalCaloriesBurnedRecord), and [Health Connect data types and permissions](https://developer.android.com/health-and-fitness/health-connect/data-types).

## 12. Blocking Questions

These questions genuinely affect implementation choices:

1. Resolved for private beta: Apple Health exact-writer intake and FatSecret are implemented intake paths; broader tracker coverage remains a later integration decision.
2. Resolved by ADR 020: Opening Bank retains the longest most-recent strictly-positive eligible suffix and presents only those dates.
3. What travel/timezone policy governs open-day aggregate replacement and later reconciliation?
4. Resolved for private beta: Clerk owns authentication; additional public-launch sign-in methods remain a later decision.
5. Resolved for private beta: Fitbit through Google Health and Apple Health are supported authoritative expenditure paths.
6. How should active, resting, total, and unknown expenditure classifications be stored and displayed when source data contains multiple types?
7. What fallback should be used when only intake or only expenditure data is available?
8. Resolved for private beta by ADRs 009 and 010 plus PB.1 continuity recovery; notification behavior remains a later milestone.
9. What timezone change behavior is allowed after onboarding?
10. Does existing MongoDB production data need to be migrated, or can V1 start with fresh beta data?
11. What minimum privacy/security bar is required before inviting beta users, especially around health-adjacent data?
12. How should Emergency Bank historical initialization, allocation-rate range, rounding, target behavior, and disable behavior work?
13. Which Planning Database provider path is feasible for restaurant meals, grocery products, packaged foods, homemade meals, and user-created planning entries?
14. Can planning entries later be exported into supported calorie-tracking applications, or do users always log consumed meals directly in their tracker?
15. What discovery-state persistence, familiarity evidence, complementarity policy, prioritization, and pacing can support ADRs 011 and 014 without introducing manipulative prompting or hiding available V1 capabilities?
16. What data threshold and deterministic estimation policy are required before Projected Daily Burn can be introduced?
17. Which provider semantics, remaining-expenditure model, and goal mapping can support Today's Eating Budget without double counting or implying a Projected Bank?
18. Are Banking Goal allocations soft or protected, and how must finalized withdrawals and provisional corrections reduce or reroute them while preserving `allocations + Unassigned = Available Bank`?
19. What is the exact allocation order between Emergency Bank and Banking Goals, and which named versioned policy governs it?
20. What deterministic baseline, step/time, familiar-activity, target, confidence, freshness, and uncertainty policy supports Time-Aware Activity Forecasting without double counting?
21. What active-day boundary and timezone/DST behavior supports remaining-time guidance for overnight workers and travel while leaving finalized accounting dates unchanged?
22. What distinct state and evidence model can enforce both Forecast Confidence and Progressive Familiarity without treating personal data volume as user understanding?
