# CalorieBank

CalorieBank is moving from a web prototype into an iPhone-first mobile V1. The current source of truth is:

- `docs/architecture/current-state-audit.md`
- `docs/product/v1-prd.md`

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

This branch establishes the monorepo and mobile shell only. It intentionally does not implement authentication, food logging, database persistence, Apple Health, USDA lookup, or ledger finalization yet.

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

`npm run lint` lints the Expo app. `npm run typecheck` and `npm test` run in every workspace that defines those scripts.

`@caloriebank/domain` and `@caloriebank/schemas` are plain TypeScript ESM packages and use Vitest 4. Vitest runs those tests directly, and Vitest 4 still supports the root Node engine (`>=20.19.0`). Vitest 5 requires Node `^22.12.0`, so it is not the runner for this repo.

The mobile app uses Jest with the `jest-expo` preset. That is the runner Expo SDK 54 supports for React Native. Vitest does not transform the native app.

## Legacy Prototype

The existing web frontend and Mongo API were moved under `legacy/` unchanged so the prototype remains available as reference while mobile V1 is built in `apps/` and `packages/`.
