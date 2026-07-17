# CalorieBank Current-State Architecture Audit

Date: 2026-07-16

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

- Manual food logging fields: food name, calories, protein, carbs, fats, date, optional image.
- Registration profile fields: height, weight, age, sex, activity level, daily calorie target.
- TDEE calculation concept, with medical/fitness disclaimers and formula review before production.
- Extra-burn logging concept and CRUD behavior.
- Daily and weekly summary UX.
- Treat-planning/Joy Bank concept as a later feature, not the first mobile slice.
- API route intent: auth, daily log, food entry, activity burn, weekly summary.
- Date-only log concept using `YYYY-MM-DD` as a user-visible day key.
- Screenshot and README material as product-reference artifacts.

Reusable with modification:

- `normalizeLogDate` logic should become a TypeScript date utility that explicitly handles user timezone and date-only strings.
- TDEE calculation should move into a typed shared or backend domain module with unit tests.
- Existing REST endpoint names can inform V1 API naming, but payloads should be versioned and validated.
- UI hierarchy can inspire React Native screens, but components must be rewritten with native primitives.

## 5. Code That Should Be Rewritten

- Entire frontend implementation should be rewritten for Expo React Native and TypeScript. The current app depends on DOM APIs, browser `localStorage`, React Router DOM, file inputs, browser CSS, Tailwind web classes, and web-only navigation.
- Backend should be rewritten or heavily refactored into TypeScript with explicit module boundaries, validation, typed request/response contracts, PostgreSQL access, migrations, and tests.
- Mongo/Mongoose models should not be carried forward because V1 calls for PostgreSQL and a transactional ledger.
- Current mutable `FoodLog.bankBalance` should be replaced with derived balances from ledger transactions.
- Current embedded `entries` and `burnedActivities` arrays should become relational rows.
- Photo upload should be postponed until after the manual core loop unless it is required for beta. If kept, it should use stricter MIME validation, object ownership records, and private object access.
- Client-side JWT decoding and browser token storage should be replaced with mobile-appropriate secure token storage and server-backed session/token validation.
- Joy Bank local-storage treat plan should be redesigned as either local-only Expo state or backend-owned goal records after the ledger core works.

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
│       │   │   ├── food-logs/
│       │   │   ├── activity/
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

`calorie_targets`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `daily_target_calories integer not null`
- `estimated_tdee_calories integer`
- `effective_from date not null`
- `effective_to date`
- `created_at timestamptz not null`

`food_logs`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `log_date date not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- Unique index: `(user_id, log_date)`.

`food_entries`

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

`calorie_ledger_transactions`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `log_date date not null`
- `type text not null` (`daily_deposit`, `food_withdrawal`, `activity_deposit`, `adjustment`, `reversal`)
- `amount_calories integer not null`
- `source_type text`
- `source_id uuid`
- `idempotency_key text`
- `description text`
- `created_at timestamptz not null`
- Unique index: `(user_id, idempotency_key)` where `idempotency_key is not null`.

Ledger convention:

- Positive amount means calories deposited into the bank.
- Negative amount means calories withdrawn from the bank.
- Balance is `sum(amount_calories)` for the relevant user and date range.
- Food entry creates or updates corresponding withdrawal transactions.
- Activity entry creates or updates corresponding deposit transactions.
- Daily target/TDEE closeout can create a daily deposit transaction after the day ends, or the service can project an in-progress day without committing a final daily transaction until closeout.

Future tables:

- `food_entry_photos`
- `favorite_foods`
- `favorite_activities`
- `health_connections`
- `health_import_batches`
- `food_database_items`
- `beta_invites`
- `sessions` or `refresh_tokens`

## 10. Phased Migration Plan

### Phase 0: Preserve Prototype and Lock Scope

- Keep current code running as reference.
- Add this audit and a V1 architecture decision record.
- Confirm whether secrets were ever committed or shared; rotate if uncertain.
- Decide whether `legacy/` should hold the current web/API code or whether V1 will replace folders in place.

### Phase 1: Monorepo Foundation

- Add root package/workspace tooling.
- Create `apps/mobile`, `apps/api`, and `packages/*`.
- Add TypeScript, linting, formatting, test runner, and environment validation.
- Add API health check and structured error format.

### Phase 2: PostgreSQL and Auth Foundation

- Add PostgreSQL client/ORM and migrations.
- Implement users, sessions/tokens, profiles, and calorie targets.
- Add password hashing, rate limiting, request validation, and auth tests.
- Create a private-beta invite or allowlist mechanism if needed.

### Phase 3: Manual Core Loop

- Implement food logs and manual food-entry CRUD.
- Implement calorie ledger transaction creation for entries.
- Implement daily summary and bank balance queries.
- Build Expo screens for login/register, today's log, add/edit food, and bank summary.

### Phase 4: Migration and Compatibility

- Write one-off migration scripts from MongoDB to PostgreSQL if existing user data matters.
- Map `User` documents to `users`, `user_profiles`, and `calorie_targets`.
- Map `FoodLog.entries` to `food_logs` and `food_entries`.
- Map `burnedActivities` to `activity_entries`.
- Convert historic `bankBalance` into either recomputed ledger transactions or a one-time opening balance adjustment.

### Phase 5: Beta Readiness

- Add observability, error tracking, backups, rate limits, privacy policy support, account deletion, and support tooling.
- Add seed data and end-to-end tests for the core loop.
- Add TestFlight build pipeline and beta environment separation.

### Phase 6: Integrations

- Add Apple Health only after manual logging and ledger reconciliation are reliable.
- Add USDA FoodData Central only after ledger behavior and manual entry UX are stable.
- Add food photos only if they support a validated beta use case.

## 11. Smallest First Vertical Slice

The smallest V1 vertical slice should be:

1. Register or sign in.
2. Set daily calorie target and timezone.
3. View today's bank/log screen in the Expo app.
4. Add one manual food entry with name and calories.
5. API persists the food entry in PostgreSQL.
6. API writes a corresponding ledger withdrawal transaction.
7. App displays today's consumed calories and current projected bank impact.

Defer for this slice:

- Macros.
- Photos.
- Apple Health.
- USDA lookup.
- Treat planning.
- Weekly charts.
- Activity import.
- Complex onboarding/TDEE estimation.

This slice proves the hardest V1 architectural decisions: mobile auth, PostgreSQL persistence, typed API, date ownership, and transactional calorie ledger.

## 12. Blocking Questions

These questions genuinely affect implementation choices:

1. Should V1 use password auth, Sign in with Apple, or both for the private beta?
2. Should the bank be based on user-selected daily calorie target, estimated TDEE, or both with separate meanings?
3. When should the daily deposit be committed: at the start of the day, at day closeout, or only as a projected value until midnight in the user's timezone?
4. What timezone should be authoritative for each user's `log_date`, and can users change it after onboarding?
5. Does existing MongoDB production data need to be migrated, or can V1 start with fresh beta data?
6. Are food photos required for private beta, or can they be removed from the first mobile release?
7. What minimum privacy/security bar is required before inviting beta users, especially around health-adjacent data?
