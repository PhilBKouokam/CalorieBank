# CalorieBank

CalorieBank is moving from a web prototype into an iPhone-first mobile V1. The current source of truth is:

- `docs/architecture/current-state-audit.md`
- `docs/product/v1-prd.md`
- `docs/product/bank-calculation-spec.md`
- `docs/product/adr-001-connection-first-v1.md`

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

This branch establishes the monorepo and mobile shell only. It intentionally does not implement authentication, integration sync, database persistence, notifications, or ledger finalization yet.

The first implementation milestones should prioritize connection-first onboarding, technically credible supported data-source sync, automatic bank calculation, transparent history, Planning Database estimates for future meals/events, and the morning bank update. Manual food logging is a fallback/correction path, not the dominant V1 loop. Bank-calculation behavior, including Available Bank, optional Emergency Bank, Recovery Forecast, and reserve-policy history, is governed by `docs/product/bank-calculation-spec.md`.

The user-facing Available Bank never displays below zero. Users may optionally reserve genuinely accumulated calories in an Emergency Bank for unexpected overages. The V1 protection sequence is Available Bank -> optional Emergency Bank -> Recovery Forecast, rather than making a large negative balance the primary focus.

## Requirements

- Node.js 20.19 or newer
- npm
- Expo Go for quick device testing

## Install

From the repository root:

```bash
npm install
```

## Run Mobile

```bash
npm run mobile:start
```

Then open the project in Expo Go or use the iOS/Android commands when the local environment supports them.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
```

`npm run test` currently runs only workspaces that define a test script.

## Legacy Prototype

The existing web frontend and Mongo API were moved under `legacy/` unchanged so the prototype remains available as reference while mobile V1 is built in `apps/` and `packages/`.
